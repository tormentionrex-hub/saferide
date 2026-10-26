const mongoose = require('mongoose');

const TRUST_REASONS = [
    'cancel_gifted_trip_passenger',
    'cancel_in_progress_ride_driver',
    'admin_increment',
    'admin_decrement',
    'admin_reset',
];

const trustHistorySchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        previous_score: {
            type: Number,
            required: true,
            min: 0,
            max: 4,
        },
        new_score: {
            type: Number,
            required: true,
            min: 0,
            max: 4,
        },
        delta: {
            type: Number,
            required: true,
        },
        reason: {
            type: String,
            required: true,
            enum: {
                values: TRUST_REASONS,
                message: 'Invalid trust history reason',
            },
        },
        actor_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        booking_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Booking',
            default: null,
        },
        ride_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Ride',
            default: null,
        },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

trustHistorySchema.index({ user_id: 1, createdAt: -1 });

const TrustHistory = mongoose.model('TrustHistory', trustHistorySchema);

module.exports = TrustHistory;
module.exports.TRUST_REASONS = TRUST_REASONS;
