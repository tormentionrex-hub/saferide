const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    driver_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Driver ID is required'],
    },
    brand: {
        type: String,
        required: [true, 'Brand is required'],
        trim: true,
    },
    model: {
        type: String,
        required: [true, 'Model is required'],
        trim: true,
    },
    license_plate: {
        type: String,
        required: [true, 'License plate is required'],
        unique: true,
        uppercase: true,
        trim: true,
        match: [/^[A-Z0-9]{6}$/, 'License plate must be 6 characters'],
    },
    color: {
        type: String,
        required: [true, 'Color is required'],
        trim: true,
    },
    year: {
        type: Number,
        required: [true, 'Year is required'],
        min: [1900, 'Year must be after 1900'],
        max: [new Date().getFullYear() + 1, 'Year cannot be in the future'],
    },
    vehicleImage: {
        type: String, // URL to the vehicle image in Blob Storage
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    capacity: {
        type: Number,
        required: [true, 'Capacity is required'],
        min: [1, 'Capacity must be at least 1'],
        max: [7, 'Capacity cannot exceed 7'],
    },
}, {
    timestamps: true,
});

// Indices
// license_plate: unique global (schema definition).
// driver_id: NO es unique global. Hay un partial unique abajo que garantiza
// un único vehículo activo por driver, permitiendo histórico de inactivos.

vehicleSchema.index({ driver_id: 1, isActive: 1 });
vehicleSchema.index(
  { driver_id: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

const Vehicle = mongoose.model('Vehicle', vehicleSchema);

module.exports = Vehicle;