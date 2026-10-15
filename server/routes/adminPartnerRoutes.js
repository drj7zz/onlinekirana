const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');
const { serverError } = require('../utils/errors');
const { notifyUser } = require('../utils/notifications');

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
    if (status === 'approved') {
      await notifyUser(partner._id, {
        type: 'approval', title: 'Shop application approved',
        body: 'Your shop is approved. You can now manage products and orders.', link: '/dashboard',
      }).catch(() => {});
    }
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
    if (status === 'approved' && product.merchant) {
      const merchant = await User.findOne({ _id: product.merchant, role: 'merchant', merchantStatus: 'approved' }).select('_id');
      if (!merchant) {
        await Product.updateOne({ _id: product._id }, { status: 'pending', isActive: false });
        return res.status(409).json({ message: 'Approve the shop application before approving its products.' });
      }
    }
    if (product.merchant) {
      await notifyUser(product.merchant, {
        type: 'approval',
        title: status === 'approved' ? 'Product approved' : 'Product not approved',
        body: `${product.name} ${status === 'approved' ? 'is now live in the shop.' : 'needs changes before it can be listed.'}`,
        link: '/products',
      }).catch(() => {});
    }
    res.json(product);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
};

router.get('/', list);
router.patch('/:id/status', setStatus);
router.patch('/customers/:id/order-restriction', async (req, res) => {
  try {
    if (req.body?.clear !== true) return res.status(400).json({ message: 'Confirm the restriction review before restoring ordering.' });
    const customer = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'customer' },
      { $set: { orderRestrictedUntil: null } },
      { new: true },
    ).select('_id name orderRestrictedUntil');
    if (!customer) return res.status(404).json({ message: 'Customer not found.' });
    res.json({ customer });
  } catch (e) {
    serverError(res, e);
  }
});
router.get('/pending-products', pendingProducts);
router.patch('/products/:id/review', reviewProduct);

module.exports = router;
