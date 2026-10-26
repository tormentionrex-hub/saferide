const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

// Middleware vacío para desarrollo — no limita nada
const noLimit = (req, res, next) => next();

// La app sondea notificaciones (30 s) y pagos (25 s) mientras está abierta y
// en una empresa muchos empleados salen por la misma IP, así que el límite
// general se cuenta por usuario (id del token, sin verificarlo: verifyToken lo
// verifica después) y por IP solo para peticiones sin sesión.
const userOrIpKey = (req) => {
  const token = req.headers.authorization?.split(' ')[1];
  const userId = token ? jwt.decode(token)?.userId : null;
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

// Lenient limiter for read operations
const readLimiter = isDev ? noLimit : rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 60,
  message: { success: false, message: 'Too many requests, please slow down.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  readLimiter,
};