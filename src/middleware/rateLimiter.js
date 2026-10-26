const rateLimit = require('express-rate-limit');

const isDev = process.env.NODE_ENV === 'development';

// Middleware vacío para desarrollo — no limita nada
const noLimit = (req, res, next) => next();

// General API rate limiter
const apiLimiter = isDev ? noLimit : rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' },
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