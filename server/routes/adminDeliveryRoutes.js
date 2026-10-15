const router = require('express').Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Delivery = require('../models/Delivery');
const Order = require('../models/Order');
const { serverError } = require('../utils/errors');
const { cleanStr, PHONE_RE } = require('../middleware/validate');
const { notifyUser } = require('../utils/notifications');

// Dispatch-board numbers, shown as cards above the job board.
const summary = async (req, res) => {
  try {
    const packedOrders = await Order.distinct('_id', { status: 'packed' });
    const [unassigned, inProgress, deliveredToday, failed, ridersOnline] = await Promise.all([
      Delivery.countDocuments({ order: { $in: packedOrders }, rider: null, status: 'pending' }),
      Delivery.countDocuments({ status: { $in: ['assigned', 'accepted', 'picked'] } }),
      Delivery.countDocuments({
        status: 'delivered',
        updatedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      }),
      Delivery.countDocuments({ status: 'failed' }),
      User.countDocuments({ role: 'delivery', riderStatus: { $in: ['available', 'on_delivery'] } }),
    ]);
    res.json({
      cards: [
        { key: 'unassigned', label: 'Waiting for a rider', value: unassigned, accent: unassigned > 0 },
        { key: 'inProgress', label: 'Out on the road', value: inProgress, accent: inProgress > 0 },
        { key: 'deliveredToday', label: 'Delivered (24h)', value: deliveredToday },
        { key: 'failed', label: 'Could not deliver', value: failed, accent: failed > 0 },
        { key: 'ridersOnline', label: 'Riders online', value: ridersOnline },
      ],
    });
  } catch (e) {
    serverError(res, e);
  }
};

/** Onboard a rider. */
const addRider = async (req, res) => {
  try {
    const name = cleanStr(req.body.name, 60);
    const email = cleanStr(req.body.email, 100).toLowerCase();
    const phone = cleanStr(req.body.phone, 15);
    const riderArea = cleanStr(req.body.riderArea, 80);
    const riderVehicle = cleanStr(req.body.riderVehicle, 40);

    const errors = {};
    if (!name) errors.name = 'Rider name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = 'Enter a valid email address';
    if (!PHONE_RE.test(phone)) errors.phone = 'Enter a valid Nepali mobile (98XXXXXXXX)';
    if (Object.keys(errors).length) return res.status(400).json({ message: 'Validation failed', errors });

    if (await User.findOne({ email })) return res.status(409).json({ message: 'That email is already registered' });

    // Riders are onboarded with a generated one-time password; the rider is
    // expected to change it from their profile on first sign-in.
    const tempPassword = `Ride@${crypto.randomBytes(16).toString('base64url')}7!`;

    const rider = await User.create({
      name,
      email,
      phone,
      password: tempPassword,
      role: 'delivery',
      riderArea,
      riderVehicle,
      riderStatus: 'available',
      merchantStatus: 'approved',
    });

    res.status(201).json({
      rider: { id: rider._id, name: rider.name, email: rider.email, phone: rider.phone, riderArea, riderVehicle, riderStatus: rider.riderStatus },
      tempPassword,
    });
  } catch (e) {
    serverError(res, e);
  }
};

/** Take a rider on/off the road, or suspend them. */
const setRiderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'available', 'on_delivery', 'offline', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const update = { riderStatus: status };
    if (status === 'available') update.merchantStatus = 'approved';
    if (status === 'suspended') update.merchantStatus = 'suspended';
    const rider = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'delivery' },
      update,
      { new: true }
    ).select('-password');
    if (!rider) return res.status(404).json({ message: 'Rider not found' });
    if (status === 'available') {
      await notifyUser(rider._id, {
        type: 'approval', title: 'Rider account approved',
        body: 'You can go on shift and accept available deliveries.', link: '/rider',
      }).catch(() => {});
    }
    res.json(rider);
  } catch (e) {
    serverError(res, e);
  }
};

router.use(auth);
router.get('/summary', summary);
router.post('/riders', addRider);
router.patch('/riders/:id/status', setRiderStatus);

module.exports = router;
