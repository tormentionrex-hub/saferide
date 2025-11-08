const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  ride_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: [true, 'Ride ID is required'],
  },
  passenger_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Passenger ID is required'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'confirmed', 'cancelled', 'completed'],
      message: 'Invalid status',
    },
    default: 'pending',
  },
  seats_booked: {
    type: Number,
    default: 1,
    min: [1, 'Must book at least 1 seat'],
    max: [7, 'Cannot book more than 7 seats'],
  },
}, {
  timestamps: true,
});

// Indexes
bookingSchema.index({ ride_id: 1 });
bookingSchema.index({ passenger_id: 1 });
bookingSchema.index({ status: 1 });

// Compound index to prevent duplicate bookings
bookingSchema.index({ ride_id: 1, passenger_id: 1 }, { unique: true });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;