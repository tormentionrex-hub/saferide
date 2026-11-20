const mongoose = require('mongoose');

// Documentos del conductor y su vehículo que revisa el admin desde el panel
// (DocumentReviewPanel). Los nombres de campos siguen lo que lee el panel:
// type, fileUrl, mimeType, status, rejectionReason, ocrText, extractedData,
// validation. ocrText/validation quedan en null: no hay servicio de análisis
// automático (POST /documents/:id/reprocess responde 503).
const DOC_TYPES = ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'];
const DOC_STATUSES = ['pending', 'processing', 'approved', 'rejected', 'needs_review'];

const vehicleDocumentSchema = new mongoose.Schema({
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', required: true },
  type: { type: String, enum: DOC_TYPES, required: true },
  fileUrl: { type: String, required: true, maxlength: 2048 },
  mimeType: { type: String, maxlength: 100, default: null },
  sizeBytes: { type: Number, min: 0, default: null },
  // De dónde vino: subida al backend o URL de Cloudinary del registro de la app.
  source: { type: String, enum: ['upload', 'app_registration'], default: 'upload' },
  status: { type: String, enum: DOC_STATUSES, default: 'pending' },
  rejectionReason: { type: String, maxlength: 300, default: null },
  resendRequested: { type: Boolean, default: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  ocrText: { type: String, default: null },
  // Datos que declaró el conductor (p. ej. número de póliza y vencimiento).
  extractedData: { type: mongoose.Schema.Types.Mixed, default: null },
  validation: { type: mongoose.Schema.Types.Mixed, default: null },
}, {
  timestamps: true,
});

vehicleDocumentSchema.index({ driver_id: 1, createdAt: -1 });
vehicleDocumentSchema.index({ vehicle_id: 1, type: 1 });
vehicleDocumentSchema.index({ status: 1, createdAt: -1 });

const VehicleDocument = mongoose.model('VehicleDocument', vehicleDocumentSchema);

module.exports = VehicleDocument;
module.exports.DOC_TYPES = DOC_TYPES;
module.exports.DOC_STATUSES = DOC_STATUSES;
