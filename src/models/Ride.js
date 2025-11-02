const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
    driver_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Driver ID is required'],
    },
    origin: {
        name: { type: String, required: true,},
        coordinates: {
            lat: { type: Number, required: true,},
            lng: { type: Number, required: true,},
        },
    },
    destination: {
        name: { type: String, required: true,},
        coordinates: {
            lat: { type: Number, required: true,},
            lng: { type: Number, required: true,},
        },
    },
    date_time: {
        type: Date,
        required: [true, 'Date and time are required'],
        validate: {
            validator: function(value){
                return value > new Date();
            },
            message: 'Date and time must be in the future',
        },
    },
    available_seats: {
        type: Number,
        required: [true, 'Available seats are required'],
        min: [1, 'At least one seat must be available'],
        max: [7, 'Available seats cannot exceed 7'],
    },
    status: {
        type: String,
        enum: {
            values: ['scheduled', 'in progress', 'completed', 'canceled'],
            message: 'Invalid Status',
        },
        default: 'scheduled',
    },
    distance_km: {
        type: Number,
        min: 0,
    },
    duration_minutes: {
        type: Number,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true},
    toObject: { virtuals: true},
});

// Indices
rideSchema.index({ driver_id: 1 });
rideSchema.index({ date_time: 1 });
rideSchema.index({ status: 1 });
rideSchema.index({ 'origin.coordinates.lat': 1, 'origin.coordinates.lng': 1 });
rideSchema.index({ 'destination.coordinates.lat': 1, 'destination.coordinates.lng': 1 });

// Virtual for Bookings
rideSchema.virtual('bookings', {
    ref: 'Booking',
    localField: '_id',
    foreignField: 'ride_id',
});

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;