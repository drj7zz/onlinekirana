const mongoose = require('mongoose');

const auditEventSchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true, maxlength: 160 },
  resourceId: { type: String, default: '', maxlength: 80 },
  outcome: { type: Number, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

auditEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AuditEvent', auditEventSchema);
