const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  adminEmail: { type: String, required: true, trim: true, lowercase: true },
  ipAddress: { type: String, required: true, trim: true, default: 'N/A' },
  action: { type: String, required: true, trim: true },
  targetType: { type: String, required: true, trim: true, default: 'system' },
  details: { type: String, required: true, trim: true },
  userAgent: { type: String, required: true, trim: true, default: 'N/A' },
}, { timestamps: true, collection: 'auditlogs' });

module.exports = mongoose.model('AuditLog', auditLogSchema);
