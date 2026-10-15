const router = require('express').Router();
const AuditEvent = require('../models/AuditEvent');

router.get('/', async (req, res) => {
  try {
    const events = await AuditEvent.find({})
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('actor', 'name email')
      .lean();
    res.json(events);
  } catch {
    res.status(500).json({ message: 'Could not load the admin audit trail.' });
  }
});

module.exports = router;
