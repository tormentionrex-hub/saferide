// Capa global contra inyección NoSQL: ningún cuerpo legítimo de la app o del
// panel trae claves que empiecen con "$" (operadores de Mongo como $ne, $gt,
// $regex) ni claves con "." (rutas anidadas). Si llegan, se rechaza la
// petición entera antes de tocar cualquier controlador. Las rutas siguen
// validando tipos por su cuenta; esto es la red de seguridad por si alguna
// se olvida.
const MAX_DEPTH = 20;

const hasOperator = (value, depth = 0) => {
  if (depth > MAX_DEPTH) return true;
  if (Array.isArray(value)) return value.some((v) => hasOperator(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.keys(value).some((k) => k.startsWith('$') || k.includes('.')
      || hasOperator(value[k], depth + 1));
  }
  return false;
};

const rejectOperators = (req, res, next) => {
  if (hasOperator(req.body) || hasOperator(req.query) || hasOperator(req.params)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid characters in request',
    });
  }
  next();
};

module.exports = { rejectOperators, hasOperator };
