const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');
const { serverError } = require('../utils/errors');

// Attach { ratingAverage, ratingCount } to a list of plain product objects in one query
const attachRatings = async (products) => {
  const ids = products.map((p) => p._id);
  if (!ids.length) return products;
  const agg = await Review.aggregate([
    { $match: { product: { $in: ids } } },
    { $group: { _id: '$product', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const map = Object.fromEntries(agg.map((a) => [String(a._id), a]));
  return products.map((p) => {
    const s = map[String(p._id)];
    const obj = p.toObject ? p.toObject() : p;
    obj.ratingAverage = s ? Math.round(s.avg * 10) / 10 : 0;
    obj.ratingCount = s ? s.count : 0;
    // .lean() strips the finalPrice virtual, so recompute it here
    obj.finalPrice = Math.round(p.price * (1 - (p.discountPercent || 0) / 100) * 100) / 100;
    return obj;
  });
};

// Public: list products with search / category / sort
exports.list = async (req, res) => {
  try {
    const { search, category, sort, min, max } = req.query;
    const approvedMerchants = await User.distinct('_id', { role: 'merchant', merchantStatus: 'approved' });
    const q = {
      isActive: true, status: 'approved',
      $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
    };
    if (search) {
      const safeSearch = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.$and = [{ $or: [
        { name: { $regex: safeSearch, $options: 'i' } },
        { category: { $regex: safeSearch, $options: 'i' } },
      ] }];
    }
    if (category && category !== 'all') q.category = String(category).slice(0, 80);
    const minValue = min === undefined ? null : Number(min);
    const maxValue = max === undefined ? null : Number(max);
    if ((minValue !== null && Number.isFinite(minValue)) || (maxValue !== null && Number.isFinite(maxValue))) {
      q.price = {
        ...(minValue !== null && Number.isFinite(minValue) ? { $gte: Math.max(0, minValue) } : {}),
        ...(maxValue !== null && Number.isFinite(maxValue) ? { $lte: Math.max(0, maxValue) } : {}),
      };
    }

    let sortOpt = { createdAt: -1 };
    if (sort === 'price_asc') sortOpt = { price: 1 };
    if (sort === 'price_desc') sortOpt = { price: -1 };
    if (sort === 'name') sortOpt = { name: 1 };

    const products = await Product.find(q).sort(sortOpt)
      .populate('merchant', 'shopName merchantStatus')
      .lean();
    res.json(await attachRatings(products));
  } catch (e) {
    serverError(res, e);
  }
};

exports.getOne = async (req, res) => {
  try {
    // The canonical URL is the product name plus its id, e.g.
    // /product/chino-eggs-6ab9ceeabb4090cfa1c8cb1b. The readable part is cosmetic
    // — the id at the end is what identifies the product — so a bare id keeps
    // working and a rename never breaks an old link.
    const raw = String(req.params.id || '');
    const slugged = raw.match(/^(.*)-([0-9a-f]{24})$/i);
    const id = slugged ? slugged[2] : raw;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Product not found' });

    // populate the seller so the product page can link to the shop (admin-listed items have merchant: null)
    const approvedMerchants = await User.distinct('_id', { role: 'merchant', merchantStatus: 'approved' });
    const product = await Product.findOne({
      _id: id, isActive: true, status: 'approved',
      $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
    })
      .populate('merchant', 'shopName shopLogoUrl shopDescription shopPhone merchantStatus shopAddress.line shopAddress.ward shopAddress.city');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // `.toObject()` does NOT carry the `finalPrice` virtual, so the raw price was
    // being sent and the product page priced a discounted item at full value.
    // The list endpoint has the same trap and patches it in `attachRatings`;
    // compute it here too so both shapes agree.
    const plain = product.toObject();
    plain.finalPrice = Math.round(plain.price * (1 - (plain.discountPercent || 0) / 100) * 100) / 100;

    // rating summary for this product
    const agg = await Review.aggregate([
      { $match: { product: product._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    plain.ratingAverage = agg[0] ? Math.round(agg[0].avg * 10) / 10 : 0;
    plain.ratingCount = agg[0] ? agg[0].count : 0;

    // a few related products from the same category (excluding this one)
    const related = await Product.find({
      _id: { $ne: product._id },
      category: product.category,
      isActive: true,
      status: 'approved',
      $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
    }).sort({ createdAt: -1 }).limit(4).lean();
    plain.related = await attachRatings(related);

    res.json(plain);
  } catch (e) {
    serverError(res, e);
  }
};

exports.categories = async (req, res) => {
  try {
    const approvedMerchants = await User.distinct('_id', { role: 'merchant', merchantStatus: 'approved' });
    const cats = await Product.distinct('category', {
      isActive: true, status: 'approved',
      $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
    });
    res.json(cats);
  } catch (e) {
    serverError(res, e);
  }
};
