const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
  },
  type: {
    type: String,
    enum: {
      values: [
        // Eventos sobre bookings (entre pasajero y conductor)
        'booking_confirmed', 'booking_cancelled', 'booking_pending', 'booking_denied',
        // Eventos sobre rides (ciclo de vida del viaje)
        'ride_reminder', 'ride_started', 'ride_completed', 'ride_cancelled',
        // Otros
        'review_request', 'system', 'trust_score_updated',
      ],
      message: 'Invalid notification type',
    },
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: {
      values: ['unread', 'read', 'archived'],
      message: 'Invalid status',
    },
    default: 'unread',
  },
  relatedEntity: {
    entityType: {
      type: String,
      enum: ['ride', 'booking', 'user'],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
  },
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ user_id: 1, status: 1 });
notificationSchema.index({ date: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;