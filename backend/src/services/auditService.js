const { AuditLog } = require('../models');

// Registra una acción sensible de admin. Recibe solo datos que arma el
// servidor (acción, objetivo y un texto fijo): nunca el cuerpo de la
// petición, así ninguna contraseña ni token puede terminar en la auditoría.
// Si falla, se registra en consola y la acción del admin sigue: la auditoría
// no debe tumbar la operación (pero el fallo queda en los logs).
const TOKENISH = /(bearer\s+\S+|eyJ[\w-]+\.[\w-]+\.[\w-]*|password\S*|contrase\S*)/gi;

const recordAudit = async (req, { action, targetType, targetId, details = '' }) => {
  try {
    await AuditLog.create({
      admin_id: req.user._id,
      adminEmail: req.user.email || null,
      action,
      targetType,
      targetId,
      // Defensa extra por si algún día alguien interpola datos del cliente.
      details: String(details).replace(TOKENISH, '[omitido]').slice(0, 500),
      ipAddress: String(req.ip || '').slice(0, 64) || null,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300) || null,
    });
  } catch (err) {
    console.error('[Audit] no se pudo registrar', action, err.message);
  }
};

module.exports = { recordAudit };
