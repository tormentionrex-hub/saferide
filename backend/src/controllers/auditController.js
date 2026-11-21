const { AuditLog } = require('../models');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 100, action, search } = req.query;
    const query = {};

    if (action) query.action = action;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { adminEmail: regex },
        { details: regex },
        { action: regex },
        { ipAddress: regex },
      ];
    }

    const [logs, count] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        total: count,
        page: Number(page),
        pages: Math.ceil(count / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};
