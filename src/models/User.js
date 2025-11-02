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
        required: [true, 'Phone number is required'],
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
        required: [true, 'Company is required'],
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
    refreshToken: {
        type: String,
        select: false, // Excluye el refreshToken por defecto en las consultas
    },
    entraID: {
        type: String,
        unique: true,
        sparse: true, // Permite valores nulos en campos únicos
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true}, 
    toObject: { virtuals: true},
});

// Índices
userSchema.index({ email: 1});
userSchema.index({ username: 1});
userSchema.index({ company: 1});
userSchema.index({ type: 1});

// Virual for vehicles owned by the user (if conductor)
userSchema.virtual('vehicle', {
    ref: 'Vehicle',
    localField: '_id',
    foreignField: 'driver_id',
    justOne: true,
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