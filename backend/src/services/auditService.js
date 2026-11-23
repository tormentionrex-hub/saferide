const { AuditLog } = require('../models');

// Registra una acción sensible de admin con el mismo formato que el resto de
// la auditoría del panel (models/AuditLog): adminEmail, acción, tipo de
// objetivo, detalle, IP y navegador. Recibe solo datos que arma el servidor
// (acción, objetivo y un texto fijo): nunca el cuerpo de la petición, así
// ninguna contraseña ni token puede terminar en la auditoría.
// Si falla, se registra en consola y la acción del admin sigue: la auditoría
// no debe tumbar la operación (pero el fallo queda en los logs).
const TOKENISH = /(bearer\s+\S+|eyJ[\w-]+\.[\w-]+\.[\w-]*|password\S*|contrase\S*)/gi;

const recordAudit = async (req, { action, targetType, targetId, details = '' }) => {
  try {
    const text = String(details || `${action} ${targetId || ''}`).replace(TOKENISH, '[omitido]').slice(0, 500);
    await AuditLog.create({
      adminEmail: req.user?.email || 'sistema',
      ipAddress: String(req.ip || req.socket?.remoteAddress || '').slice(0, 64) || 'N/A',
      action,
      targetType: String(targetType || 'system').toLowerCase(),
      details: targetId ? `${text} [${targetId}]`.slice(0, 520) : text,
      userAgent: String(req.headers['user-agent'] || '').slice(0, 300) || 'N/A',
    });
  } catch (err) {
    console.error('[Audit] no se pudo registrar', action, err.message);
  }
};

module.exports = { recordAudit };
