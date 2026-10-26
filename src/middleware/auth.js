const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request.
    // Nota: NO rechazamos por isActive=false aquí. Un usuario con trustScore=0
    // (e isActive=false) debe poder seguir leyendo sus datos y completando
    // viajes existentes. El bloqueo de creación de nuevos bookings/rides se
    // hace con el middleware requireActive aplicado puntualmente.
    const user = await User.findById(decoded.userId).select('-password -refreshToken');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.',
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired.',
      });
    }
    
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
};

// Check user roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated.',
      });
    }

    if (!roles.includes(req.user.type)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      
      if (user) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

// Bloquea endpoints de creación cuando el usuario tiene isActive=false
// (típicamente porque su trustScore cayó a 0). Devuelve 403 con un código
// específico para que el frontend NO redirija al login: la sesión sigue
// siendo válida, solo está limitada.
const requireActive = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'User not authenticated.',
    });
  }

  if (!req.user.isActive) {
    return res.status(403).json({
      success: false,
      code: 'ACCOUNT_INACTIVE',
      message: 'Tu cuenta está limitada. No puedes crear nuevos viajes o reservas. Contacta a soporte para reactivarla.',
    });
  }

  next();
};

module.exports = {
  verifyToken,
  authorize,
  optionalAuth,
  requireActive,
};