const mongoose = require('mongoose');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Review = require('../models/Review');
const { serverError } = require('../utils/errors');
const { cached, cacheInvalidate } = require('../lib/platform');
const { fuzzyPattern, relevanceScore, isFuzzyOnly } = require('../lib/productSearch');

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
// Cached in Redis for 45s — the storefront home/shop page hits this on every
// visit; a short TTL absorbs traffic spikes while staying fresh enough.
exports.list = async (req, res) => {
  try {
    const { search, category, sort, min, max, lat, lng } = req.query;
    const cacheKey = `products:${search || ''}:${category || ''}:${sort || ''}:${min || ''}:${max || ''}:${lat || ''}:${lng || ''}`;
    const products = await cached(cacheKey, 45, async () => {
      const approvedMerchants = await User.distinct('_id', { role: 'merchant', merchantStatus: 'approved' });
      const q = {
        isActive: true, status: 'approved',
        $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
      };
      if (category && category !== 'all') q.category = String(category).slice(0, 80);
      const minValue = min === undefined ? null : Number(min);
      const maxValue = max === undefined ? null : Number(max);
      if ((minValue !== null && Number.isFinite(minValue)) || (maxValue !== null && Number.isFinite(maxValue))) {
        q.price = {
          ...(minValue !== null && Number.isFinite(minValue) ? { $gte: Math.max(0, minValue) } : {}),
          ...(maxValue !== null && Number.isFinite(maxValue) ? { $lte: Math.max(0, maxValue) } : {}),
        };
      }
      if (search) {
        const safeSearch = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Literal match first; if a search returns nothing literal we widen the
        // net so the fuzzy scoring below still has candidates to rank. This is
        // what turns "milk2" into "Milk" — one broadened pass, still cached.
        const literal = await Product.countDocuments({
          ...q,
          $and: [{ $or: [{ name: { $regex: safeSearch, $options: 'i' } }, { category: { $regex: safeSearch, $options: 'i' } }] }],
        });
        if (literal === 0) {
          const words = String(search).toLowerCase().split(/\s+/).filter((w) => w.length > 1 && w.length <= 24).slice(0, 4);
          if (words.length) {
            const fuzzyParts = words
              .map((word) => fuzzyPattern(word))
              .filter(Boolean)
              .map((pattern) => ({ name: { $regex: pattern, $options: 'i' } }));
            if (fuzzyParts.length) q.$and = [{ $or: fuzzyParts }];
            else q._id = { $in: [] };
          } else {
            q._id = { $in: [] };
          }
        } else {
          q.$and = [{ $or: [
            { name: { $regex: safeSearch, $options: 'i' } },
            { category: { $regex: safeSearch, $options: 'i' } },
          ] }];
        }
      }
      let sortOpt = { createdAt: -1 };
      if (sort === 'price_asc') sortOpt = { price: 1 };
      if (sort === 'price_desc') sortOpt = { price: -1 };
      if (sort === 'name') sortOpt = { name: 1 };

      let docs = await Product.find(q).sort(sortOpt)
        .populate('merchant', 'shopName merchantStatus shopAddress.location')
        .lean();
      // Nearby-shop ranking: when the customer shares a delivery pin, products
      // sold by shops close to that pin get pushed to the top. Distance is a
      // straight-line estimate; the exact fee is still quoted at checkout.
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && !sort) {
        const toRad = (d) => (d * Math.PI) / 180;
        docs = docs
          .map((p) => {
            const loc = p.merchant?.shopAddress?.location;
            if (!loc || !Number.isFinite(Number(loc.lat)) || !Number.isFinite(Number(loc.lng))) return { p, km: null };
            const dLat = toRad(Number(loc.lat) - lat);
            const dLng = toRad(Number(loc.lng) - lng);
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(Number(loc.lat))) * Math.sin(dLng / 2) ** 2;
            const km = Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
            return { p, km };
          })
          .sort((a, b) => {
            if (a.km === null && b.km === null) return 0;
            if (a.km === null) return 1;   // platform / no-pin shops last
            if (b.km === null) return -1;
            return a.km - b.km;
          })
          .map((x) => x.p);
      }
      return docs;
    });
    let list = await attachRatings(products);

    // badge flags: bestseller = top 5 by units sold; new = created last 7 days.
    // Two cheap aggregate queries, cached along with the list itself.
    const soldAgg = await cached('bestseller-ids', 120, async () => {
      const rows = await Order.aggregate([
        { $match: { status: { $ne: 'cancelled' } } },
        { $unwind: '$items' },
        { $group: { _id: '$items.product', qty: { $sum: '$items.qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 5 },
      ]);
      return rows.map((r) => String(r._id));
    });
    const bestsellers = new Set(soldAgg);
    const NEW_MS = 7 * 24 * 60 * 60 * 1000;
    list = list.map((p) => ({
      ...p,
      bestseller: bestsellers.has(String(p._id)),
      isNew: (Date.now() - new Date(p.createdAt).getTime()) < NEW_MS,
    }));
    // Relevance ranking only applies to keyword searches with no explicit
    // user-chosen sort — picking "price low to high" must keep price order.
    let fuzzyOnly = false;
    if (search && !sort) {
      const terms = String(search).toLowerCase().split(/\s+/).filter(Boolean).slice(0, 5);
      list = list
        .map((p) => ({ p, s: relevanceScore(p, terms) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((x) => x.p);
      // every result came only from the typo-fuzzy tier → tell the UI so it can
      // show "showing closest matches for …" instead of pretending a literal hit
      fuzzyOnly = list.length > 0 && list.every((p) => isFuzzyOnly(p, terms));
    }
    res.json({ fuzzy: fuzzyOnly, items: list });
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
    // categories rarely change — cache for 5 minutes
    const cats = await cached('product-categories', 300, async () => {
      const approvedMerchants = await User.distinct('_id', { role: 'merchant', merchantStatus: 'approved' });
      return Product.distinct('category', {
        isActive: true, status: 'approved',
        $or: [{ merchant: null }, { merchant: { $in: approvedMerchants } }],
      });
    });
    res.json(cats);
  } catch (e) {
    serverError(res, e);
  }
};
