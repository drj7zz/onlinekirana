const Product = require('../models/Product');
const { serverError } = require('../utils/errors');

// ---------- Admin only ----------
// Mass-assignment guard: a whitelist of fields a client may set, shared by
// create and update, so no endpoint ever spreads raw `req.body` onto a Model.
const ADMIN_WRITABLE = ['name', 'description', 'category', 'price', 'unit', 'stock', 'imageUrl', 'discountPercent', 'isActive'];
const pickWritable = (body) => {
  const out = {};
  for (const k of ADMIN_WRITABLE) if (body?.[k] !== undefined) out[k] = body[k];
  return out;
};

exports.adminList = async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    res.json(products);
  } catch (e) {
    serverError(res, e);
  }
};

exports.create = async (req, res) => {
  try {
    const patch = pickWritable(req.body);
    if (!patch.name || !patch.category || patch.price == null) {
      return res.status(400).json({ message: 'Name, category and price are required' });
    }
    const product = await Product.create(patch);
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const patch = pickWritable(req.body);
    if (!Object.keys(patch).length) return res.status(400).json({ message: 'Nothing to update' });
    const product = await Product.findByIdAndUpdate(req.params.id, patch, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (e) {
    serverError(res, e);
  }
};
