const Product = require('../models/Product');
const { serverError } = require('../utils/errors');

// ---------- Admin only ----------
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
    const { name, description, category, price, unit, stock, imageUrl, discountPercent } = req.body;
    if (!name || !category || price == null) {
      return res.status(400).json({ message: 'Name, category and price are required' });
    }
    const product = await Product.create({ name, description, category, price, unit, stock, imageUrl, discountPercent });
    res.status(201).json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

exports.update = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
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
