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
  ride_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Ride', default: null },
  booking_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null },
  passenger_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  driver_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  tripOrigin: { type: String, default: '' },
  tripDestination: { type: String, default: '' },
  tripDate: { type: String, default: '' },
  tripPrice: { type: Number, default: 0 },
  source: { type: String, default: 'real' },
  reply: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true, collection: 'complaints' });

module.exports = mongoose.model('Complaint', complaintSchema);
