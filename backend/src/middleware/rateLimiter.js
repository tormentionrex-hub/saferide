const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Middleware vacío para desarrollo — no limita nada
const noLimit = (req, res, next) => next();

// La app sondea notificaciones (30 s) y pagos (25 s) mientras está abierta y
// en una empresa muchos empleados salen por la misma IP, así que el límite
// general se cuenta por usuario y por IP solo para peticiones sin sesión.
// La firma del token se verifica aquí: con jwt.decode, un token inventado con
// un userId distinto en cada petición estrenaba un contador nuevo cada vez y
// el límite no frenaba nada. Un token inválido cuenta por IP.
const userOrIpKey = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  let userId = null;
  if (token) {
    try {
      userId = jwt.verify(token, process.env.JWT_SECRET)?.userId || null;
    } catch {
      userId = null;
    }
  }
  return userId ? `user:${userId}` : `ip:${ipKeyGenerator(req.ip)}`;
};

// General API rate limiter: 600 peticiones / 15 min por usuario (~40/min).
const apiLimiter = isDev ? noLimit : rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 600,
  keyGenerator: userOrIpKey,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for authentication endpoints
const authLimiter = isDev ? noLimit : rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many authentication attempts, please try again later.' },
  skipSuccessfulRequests: true,
});

// Envío de códigos por correo. authLimiter no sirve aquí: no cuenta las
// respuestas exitosas, y un envío exitoso es justamente el abuso (correos sin
// límite a cualquier dirección, y cada envío borra el código pendiente de esa
// persona, que no puede terminar su recuperación). Dos topes independientes:
// por IP y por correo de destino (normalizado por la validación de la ruta).
const sendCodeIpLimiter = isDev ? noLimit : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many verification codes requested, please try again later.' },
});
const sendCodeEmailLimiter = isDev ? noLimit : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => `email:${String(req.body?.email || '').trim().toLowerCase()}`,
  message: { success: false, message: 'Too many verification codes requested, please try again later.' },
});

// Borrar la cuenta pide la contraseña: sin tope, con un token robado se podía
// adivinar la contraseña a fuerza bruta por DELETE /users/me (que no pasa
// por el limitador del login). Solo cuentan los intentos fallidos. Dos topes:
// por usuario (va después de verifyToken) y por IP.
const deleteAccountUserLimiter = isDev ? noLimit : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `del-user:${req.user?._id || 'anon'}`,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});
const deleteAccountIpLimiter = isDev ? noLimit : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many attempts, please try again later.' },
});

// Lenient limiter for read operations
const readLimiter = isDev ? noLimit : rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests, please slow down.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  deleteAccountUserLimiter,
  deleteAccountIpLimiter,
  readLimiter,
};