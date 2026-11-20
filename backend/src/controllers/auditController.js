const { AuditLog } = require('../models');

// @desc   Registro de auditoría de acciones de admin
// @route  GET /api/v1/audit-logs?page&limit&action&targetType&adminId&from&to
// @access Private/Admin
//
// Forma que lee el panel (AuditoriaPage): _id, action, adminEmail, details,
// targetType, ipAddress, userAgent, createdAt. Más reciente primero.
exports.getAuditLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const q = {};
    if (req.query.action) q.action = req.query.action;
    if (req.query.targetType) q.targetType = req.query.targetType;
    if (req.query.adminId) q.admin_id = req.query.adminId;
    if (req.query.from || req.query.to) {
      q.createdAt = {};
      if (req.query.from) q.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) q.createdAt.$lte = new Date(req.query.to);
    }
    const [data, total] = await Promise.all([
      AuditLog.find(q)
        .select('_id action adminEmail details targetType targetId ipAddress userAgent createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(q),
    ]);
    res.status(200).json({ success: true, data, pagination: { total, page, pages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
};
