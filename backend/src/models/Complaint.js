const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema({
  user: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true },
  subject: { type: String, required: true, trim: true },
  fullMessage: { type: String, required: true, trim: true },
  message: { type: String, trim: true },
  category: {
    type: String,
    required: true,
    enum: ['Pagos', 'Conducta', 'Seguridad', 'Soporte Técnico'],
    default: 'Soporte Técnico',
  },
  status: {
    type: String,
    required: true,
    enum: ['Pendiente', 'Atendido'],
    default: 'Pendiente',
  },
  tripId: { type: String, default: 'N/A' },
  reply: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'complaints' });

module.exports = mongoose.model('Complaint', complaintSchema);
