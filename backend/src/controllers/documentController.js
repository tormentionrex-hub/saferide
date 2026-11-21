const { Document, AuditLog } = require('../models');

const REVIEW_ACTIONS = {
  approve: { status: 'approved', audit: 'DOCUMENT_APPROVED' },
  reject: { status: 'rejected', audit: 'DOCUMENT_REJECTED' },
  request_resend: { status: 'needs_review', audit: 'DOCUMENT_RESEND_REQUESTED' },
};

const recordAudit = async (req, action, details) => {
  await AuditLog.create({
    adminEmail: req.user?.email || 'sistema',
    ipAddress: req.ip || req.socket?.remoteAddress || 'N/A',
    action,
    targetType: 'document',
    details,
    userAgent: req.get('user-agent') || 'N/A',
  });
};

exports.getDocumentsByDriver = async (req, res, next) => {
  try {
    const { driverId } = req.params;
    if (req.user.type !== 'admin' && req.user._id.toString() !== driverId) {
      return res.status(403).json({ success: false, message: 'Acceso denegado' });
    }

    const documents = await Document.find({ driver_id: driverId }).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
};

exports.getPendingDocuments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { status: { $in: ['pending', 'processing', 'needs_review'] } };

    const [documents, count] = await Promise.all([
      Document.find(query)
        .populate('driver_id', 'name email username')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      Document.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: documents,
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

exports.reviewDocument = async (req, res, next) => {
  try {
    const config = REVIEW_ACTIONS[req.body.action];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Acción inválida' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    document.status = config.status;
    document.rejectionReason = req.body.reason || '';
    document.reviewedBy = req.user._id;
    document.reviewedAt = new Date();
    await document.save();

    await recordAudit(req, config.audit, `${document.type} ${document._id}: ${req.body.action}`);

    res.status(200).json({ success: true, message: 'Documento actualizado', data: document });
  } catch (error) {
    next(error);
  }
};

exports.reprocessDocument = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Documento no encontrado' });
    }

    document.status = 'processing';
    document.validation = {};
    document.ocrText = '';
    document.rejectionReason = '';
    await document.save();

    await recordAudit(req, 'DOCUMENT_REPROCESSED', `Reprocesó ${document.type} ${document._id}`);

    res.status(200).json({ success: true, message: 'Documento en reprocesamiento', data: document });
  } catch (error) {
    next(error);
  }
};
