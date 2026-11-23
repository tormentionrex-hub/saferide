const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    match: /^\d{6}$/,
  },
  // Intentos de validación gastados. Con 6 dígitos y sin este tope el código
  // se podía adivinar a fuerza bruta dentro de sus 10 minutos.
  attempts: {
    type: Number,
    default: 0,
  },
  // Cuándo se verificó con verify-code. Un código verificado ya no sirve
  // para verificar ni para restablecer la contraseña: queda reservado para
  // que POST /auth/register lo consuma (usedAt lo reclama de forma atómica).
  verifiedAt: {
    type: Date,
    default: null,
  },
  usedAt: {
    type: Date,
    default: null,
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    index: { expires: 0 }, // Automatically delete after expiresAt
  },
}, {
  timestamps: true,
});

const VerificationCode = mongoose.model('VerificationCode', verificationCodeSchema);

module.exports = VerificationCode;
