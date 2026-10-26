const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        minlength: [4, 'Name must be at least 4 characters'],
    },
    username: {
        type: String,
        required: [true, 'Username is required'],
        unique: true,
        trim: true,
        minlength: [4, 'Username must be at least 4 characters'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Please proide a valid email address'],
    },
    phone: {
        type: String,
        required: [function () { return this.type !== 'admin'; }, 'Phone number is required'],
        match: [/^\d{8}$/, 'Phone number must be 8 digits'],
    },
    password: {
        type: String,
        required: [true, 'Password is required'],
        minlength: [8, 'Password must be at least 8 characters'],
        select: false, // Excluye el password por defecto en las consultas
    },
    company: {
        type: String,
        required: [function () { return this.type !== 'admin'; }, 'Company is required'],
        enum: {
            values: ['Intel', 'Cargill', 'Deloitte', 'Citi', 'Experian', '3M', 'DHL', 'Bill Gosling Outsourcing (BGO)', 'WeWork Costa Rica', 'Concentrix', 'Nestlé Costa Rica'],
            message: 'Invalid company selected',
        },
    },
    work_schedule: {
        type: String,
        trim: true,
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: 5,
    },
    type: {
        type: String,
        required: true,
        enum: {
            values: ['conductor', 'pasajero', 'admin'],
            message: 'Type must be either conductor, pasajero, or admin',
        },
        default: 'pasajero',
    },
    profileImage: {
        type: String, // URL de la imagen de perfil en Blob Storage
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // Semántica: usuario de confianza. Default 4 = 4 oportunidades.
    // Cuando trustScore=0 → isActive=false (bloquea creación de nuevos
    // bookings/rides vía requireActive middleware). Admin queda inmune
    // al decremento por convención aplicada en trustService.
    trustScore: {
        type: Number,
        default: 4,
        min: 0,
        max: 4,
    },
    currentLocation: {
        lat: { type: Number },
        lng: { type: Number },
        updatedAt: { type: Date }
    },
    refreshToken: {
        type: String,
        select: false, // Excluye el refreshToken por defecto en las consultas
    },
    entraID: {
        type: String,
        unique: true,
        sparse: true,
    },
    expoPushToken: {
        type: String,
        select: false,
    },
    // Preferencia de opt-in para notificaciones push del SO.
    // - true  → backend envía push del SO además de guardar el registro
    //           en la campana (Notification).
    // - false → backend solo guarda el registro; el usuario sigue viendo
    //           la notificación dentro de la app, pero no aparece como
    //           notificación del sistema operativo.
    //
    // OJO: este campo NO debe confundirse con `isActive` (usado para
    // cuentas limitadas por trustScore=0). Son completamente independientes.
    // Default true para mantener compatibilidad con usuarios existentes.
    optIn: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true}, 
    toObject: { virtuals: true},
});

// Índices
// Note: email and username already have unique indexes from the schema definition (unique: true)
// Only add non-unique indexes here
userSchema.index({ company: 1});
userSchema.index({ type: 1});

// Virtual for vehicles owned by the user (if conductor)
userSchema.virtual('vehicle', {
    ref: 'Vehicle',
    localField: '_id',
    foreignField: 'driver_id',
    justOne: true,
    match: { isActive: true },
});

// Hash password before saving
userSchema.pre('save', async function(next){
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        next(error);
    }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get public profile
userSchema.methods.toPublicJSON = function() {
    const obj = this.toObject();
    delete obj.password;
    delete obj.refreshToken;
    delete obj.__v;
    return obj;
};

const User = mongoose.model('User', userSchema);

module.exports = User;