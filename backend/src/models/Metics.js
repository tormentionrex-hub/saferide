const mongoose = require('mongoose');

const metricsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  role: {
    type: String,
    enum: ['conductor', 'pasajero'],
    required: [true, 'Role is required'],
  },
  kilometers_driven: {
    type: Number,
    default: 0,
    min: 0,
    // Vehicle perspective.
    // For conductor: sum of ride.distance_km over completed rides that had at least one completed booking.
    // For pasajero: sum of booking.distance_km over their completed bookings (km traveled as a passenger).
  },
  passenger_kilometers: {
    type: Number,
    default: 0,
    min: 0,
    // Impact perspective. Only meaningful for conductor — passenger entries leave this at 0.
    // For conductor: sum of booking.distance_km over completed bookings (= N_passengers × ride_km per ride).
  },
  carbon_footprint: {
    type: Number,
    default: 0,
    min: 0,
    // Calculated as kg of CO2 saved
  },
  total_rides: {
    type: Number,
    default: 0,
    min: 0,
    // For conductor: completed rides. For pasajero: completed bookings.
  },
  total_passengers: {
    type: Number,
    default: 0,
    min: 0,
    // Only meaningful for conductor; pasajero is always 0
  },
  period: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'yearly', 'total'],
    default: 'total',
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes
metricsSchema.index({ user_id: 1, role: 1, period: 1, date: -1 });

const Metrics = mongoose.model('Metrics', metricsSchema);

module.exports = Metrics;