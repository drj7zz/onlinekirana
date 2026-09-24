const Product = require('../models/Product');
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
    const q = { isActive: true, status: 'approved' };
    if (search) q.$or = [
      { name: { $regex: search, $options: 'i' } },
      { category: { $regex: search, $options: 'i' } },
    ];
    if (category && category !== 'all') q.category = category;
    if (min || max) q.price = { ...(min && { $gte: +min }), ...(max && { $lte: +max }) };

    let sortOpt = { createdAt: -1 };
    if (sort === 'price_asc') sortOpt = { price: 1 };
    if (sort === 'price_desc') sortOpt = { price: -1 };
    if (sort === 'name') sortOpt = { name: 1 };

    const products = await Product.find(q).sort(sortOpt).lean();
    res.json(await attachRatings(products));
  } catch (e) {
    serverError(res, e);
  }
};

exports.getOne = async (req, res) => {
  try {
    // populate the seller so the product page can link to the shop (admin-listed items have merchant: null)
    const product = await Product.findById(req.params.id)
      .populate('merchant', 'shopName shopLogoUrl shopDescription shopPhone shopAddress merchantStatus');
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const plain = product.toObject();

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
    }).sort({ createdAt: -1 }).limit(4).lean();
    plain.related = await attachRatings(related);

    res.json(plain);
  } catch (e) {
    serverError(res, e);
  }
};

exports.categories = async (req, res) => {
  try {
    const cats = await Product.distinct('category', { isActive: true });
    res.json(cats);
  } catch (e) {
    serverError(res, e);
  }
};
