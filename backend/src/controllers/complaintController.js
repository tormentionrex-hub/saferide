const { Complaint, AuditLog } = require('../models');

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const recordAudit = async (req, action, targetType, details) => {
  await AuditLog.create({
    adminEmail: req.user?.email || 'sistema',
    ipAddress: req.ip || req.socket?.remoteAddress || 'N/A',
    action,
    targetType,
    details,
    userAgent: req.get('user-agent') || 'N/A',
  });
};

exports.getComplaints = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category, search } = req.query;
    const query = {};

    if (status) query.status = status;
    if (category && category !== 'Todos') query.category = category;
    if (search) {
      const regex = new RegExp(escapeRegex(search), 'i');
      query.$or = [
        { user: regex },
        { email: regex },
        { subject: regex },
        { fullMessage: regex },
      ];
    }

    const [complaints, count] = await Promise.all([
      Complaint.find(query).sort({ createdAt: -1 }).limit(Number(limit)).skip((Number(page) - 1) * Number(limit)),
      Complaint.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: complaints,
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

exports.replyComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Queja no encontrada' });
    }

    complaint.reply = req.body.message;
    complaint.status = 'Atendido';
    complaint.resolvedAt = new Date();
    await complaint.save();

    await recordAudit(req, 'COMPLAINT_RESOLVED', 'complaint', `Respondió la queja ${complaint._id}: ${complaint.subject}`);

    res.status(200).json({ success: true, message: 'Respuesta registrada', data: complaint });
  } catch (error) {
    next(error);
  }
};

exports.resolveComplaint = async (req, res, next) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: 'Queja no encontrada' });
    }

    complaint.status = 'Atendido';
    complaint.resolvedAt = new Date();
    await complaint.save();

    await recordAudit(req, 'COMPLAINT_RESOLVED', 'complaint', `Marcó como atendida la queja ${complaint._id}: ${complaint.subject}`);

    res.status(200).json({ success: true, message: 'Queja marcada como atendida', data: complaint });
  } catch (error) {
    next(error);
  }
};
