const mongoose = require('mongoose');

const metricsSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  kilometers_driven: {
    type: Number,
    default: 0,
    min: 0,
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
  },
  total_passengers: {
    type: Number,
    default: 0,
    min: 0,
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
metricsSchema.index({ user_id: 1, period: 1, date: -1 });

const Metrics = mongoose.model('Metrics', metricsSchema);

module.exports = Metrics;