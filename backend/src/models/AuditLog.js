const mongoose = require('mongoose');

// Registro de acciones sensibles de administración (GET /audit-logs lo lee
// el panel). Los registros los arma solo el servidor (services/auditService)
// con textos fijos: nunca se guarda el cuerpo de la petición, ni contraseñas,
// ni tokens. adminEmail se copia al momento de la acción para que el registro
// siga siendo legible si la cuenta del admin cambia o se borra.
const AUDIT_ACTIONS = [
  'USER_ACTIVATED',
  'USER_DEACTIVATED',
  'USER_TRUST_CHANGED',
  'USER_HARD_DELETED',
  'VEHICLE_APPROVED',
  'VEHICLE_REJECTED',
  'DOCUMENT_APPROVED',
  'DOCUMENT_REJECTED',
  'DOCUMENT_RESEND_REQUESTED',
];

const auditLogSchema = new mongoose.Schema({
  admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adminEmail: { type: String, maxlength: 254 },
  action: { type: String, enum: AUDIT_ACTIONS, required: true },
  targetType: { type: String, enum: ['User', 'Vehicle', 'VehicleDocument'], required: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  details: { type: String, maxlength: 500, default: '' },
  ipAddress: { type: String, maxlength: 64, default: null },
  userAgent: { type: String, maxlength: 300, default: null },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ admin_id: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
