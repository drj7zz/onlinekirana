const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const { serverError } = require('../utils/errors');

router.use(auth);

// Admin regulates merchants: list, approve, suspend
const list = async (req, res) => {
  try {
    const partners = await User.find({ role: 'merchant' }).sort({ createdAt: -1 }).select('-password');
    res.json(partners);
  } catch (e) {
    serverError(res, e);
  }
};

const setStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'approved', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const partner = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'merchant' },
      { merchantStatus: status },
      { new: true }
    ).select('-password');
    if (!partner) return res.status(404).json({ message: 'Partner not found' });
    // suspending a partner also hides their products
    if (status === 'suspended') await Product.updateMany({ merchant: partner._id }, { isActive: false });
    if (status === 'approved') await Product.updateMany({ merchant: partner._id, status: 'approved' }, { isActive: true });
    res.json(partner);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

const pendingProducts = async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending' }).sort({ createdAt: -1 }).populate('merchant', 'shopName name');
    res.json(products);
  } catch (e) {
    serverError(res, e);
  }
};

const reviewProduct = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status, isActive: status === 'approved' },
      { new: true }
    );
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

router.get('/', list);
router.patch('/:id/status', setStatus);
router.get('/pending-products', pendingProducts);
router.patch('/products/:id/review', reviewProduct);

module.exports = router;
