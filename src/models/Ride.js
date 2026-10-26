const mongoose = require('mongoose');
const tz = require('../utils/timeZone');

const rideSchema = new mongoose.Schema({
    driver_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Driver ID is required'],
    },
    origin: {
        name: { type: String, required: true, },
        coordinates: {
            lat: { type: Number, required: true, },
            lng: { type: Number, required: true, },
        },
    },
    destination: {
        name: { type: String, required: true, },
        coordinates: {
            lat: { type: Number, required: true, },
            lng: { type: Number, required: true, },
        },
    },
    fecha: {
        type: String,
        required: [true, 'La fecha es obligatoria'],
        match: [/^\d{4}-\d{2}-\d{2}$/, 'Formato inválido (YYYY-MM-DD)'],
        validate: {
            validator: function (value) {
                const nowDateString = tz.now().toFormat('yyyy-MM-dd');
                return value === nowDateString;
            },
            message: 'Solo puedes crear viajes para la fecha de hoy.'
        }
    },
    hora: {
        type: String,
        required: [true, 'La hora es obligatoria'],
        match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Formato de hora inválido (HH:mm)'],
        validate: {
            validator: function (value) {
                if (!this.fecha) return false;
                const nowLuxon = tz.now();
                
                const [year, month, day] = this.fecha.split('-').map(Number);
                const [h, m] = value.split(':').map(Number);
                
                const valTime = nowLuxon.set({ year, month: month, day, hour: h, minute: m, second: 0, millisecond: 0 });
                const minAllowed = nowLuxon.plus({ minutes: 5 }).set({ second: 0, millisecond: 0 });
                
                console.log(`[Mongoose Debug] valTime: ${valTime.toISO()} | minAllowed: ${minAllowed.toISO()}`);

                return valTime >= minAllowed;
            },
            message: 'Database check failed: El viaje debe programarse con al menos 5 minutos de anticipación al futuro.'
        }
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
            // 'awaiting_payment_verification' es el estado intermedio entre
            // que el conductor toca "Finalizar viaje" y que confirma los
            // pagos en PaymentVerification. Durante ese lapso, los bookings
            // siguen en 'confirmed' y nada de métricas / reviews / ranking
            // se dispara todavía.
            values: ['scheduled', 'in progress', 'awaiting_payment_verification', 'completed', 'cancelled'],
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
    suggested_price: {
        type: Number,
        min: 0,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});

rideSchema.pre('save', async function (next) {
    if (!this.isModified('fecha') && !this.isModified('hora')) {
        return next();
    }

    try {
        // Encontrar todos los viajes activos del conductor para ese día
        const existingRides = await this.constructor.find({
            driver_id: this.driver_id,
            fecha: this.fecha,
            status: { $nin: ['cancelled'] },
            _id: { $ne: this._id }
        });

        const [h, m] = this.hora.split(':').map(Number);
        const nowLuxon = tz.now(); // Solo para tener la zona horaria correcta
        const thisTime = nowLuxon.set({ hour: h, minute: m, second: 0, millisecond: 0 });

        for (const ride of existingRides) {
            const [rh, rm] = ride.hora.split(':').map(Number);
            const rideTime = nowLuxon.set({ hour: rh, minute: rm, second: 0, millisecond: 0 });
            
            const diff = Math.abs(thisTime.diff(rideTime, 'minutes').minutes);
            
            if (diff < 5) {
                // 409 y no 500: es una regla de negocio, no un fallo del servidor.
                const conflict = new Error(`Conflicto de horario: Ya tienes un viaje a las ${ride.hora}. Debe haber al menos 5 minutos entre viajes.`);
                conflict.statusCode = 409;
                return next(conflict);
            }
        }
        
        next();
    } catch (err) {
        next(err);
    }
});

// Indices
rideSchema.index({ driver_id: 1 });
rideSchema.index({ fecha: 1, hora: 1 });
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