const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    required: true,
    enum: ['cedula', 'licencia', 'poliza', 'marchamo', 'rtv', 'tarjeta_circulacion'],
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'processing', 'approved', 'rejected', 'needs_review'],
    default: 'pending',
  },
  fileUrl: { type: String, required: true },
  mimeType: { type: String, default: 'application/pdf' },
  extractedData: { type: mongoose.Schema.Types.Mixed, default: {} },
  validation: { type: mongoose.Schema.Types.Mixed, default: {} },
  ocrText: { type: String, default: '' },
  rejectionReason: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  // Campos de los documentos que sube la app (opcionales: los del seed no los traen).
  vehicle_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
  sizeBytes: { type: Number, min: 0, default: null },
  source: { type: String, enum: ['upload', 'app_registration', 'seed'], default: 'upload' },
}, { timestamps: true, collection: 'documents' });

documentSchema.index({ driver_id: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('Document', documentSchema);
