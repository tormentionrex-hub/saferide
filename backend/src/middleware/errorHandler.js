// El stack (rutas del servidor, nombres de archivos) nunca sale en
// producción; en otros entornos solo si se pide con EXPOSE_ERROR_STACK=true.
const exposeStack = () => process.env.NODE_ENV !== 'production' && process.env.EXPOSE_ERROR_STACK === 'true';

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Cuerpo JSON inválido o demasiado grande (body-parser): 400/413 limpio,
  // sin el detalle del parser.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, message: 'Request body too large' });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message,
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`,
    });
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Default error. En producción un 500 no devuelve el mensaje interno
  // (nombres de campos, rutas, detalles del driver de Mongo); los errores
  // con statusCode explícito (4xx propios) sí conservan su mensaje.
  const status = err.statusCode || err.status || 500;
  const hideMessage = status >= 500 && process.env.NODE_ENV === 'production';
  res.status(status).json({
    success: false,
    message: hideMessage ? 'Internal server error' : (err.message || 'Internal server error'),
    ...(exposeStack() && { stack: err.stack }),
  });
};

module.exports = errorHandler;