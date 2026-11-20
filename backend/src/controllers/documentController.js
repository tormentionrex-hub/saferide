const mongoose = require('mongoose');
const { Vehicle, VehicleDocument } = require('../models');
const { DOC_TYPES } = require('../models/VehicleDocument');
const { isBlobConfigured, uploadPrivateDocument, getBlobSasUrl, deleteFromBlob, DOCUMENTS_CONTAINER } = require('../services/blobService');
const { recordAudit } = require('../services/auditService');

// Campos que salen hacia el panel o el conductor (nada interno de más).
const PUBLIC_FIELDS = '_id driver_id vehicle_id type fileUrl mimeType sizeBytes source status rejectionReason resendRequested reviewedAt ocrText extractedData validation createdAt updatedAt';

// El contenido real del archivo debe coincidir con el tipo que declara el
// cliente (multer solo ve el mimetype que manda el cliente).
const SIGNATURES = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.length > 5 && b.slice(0, 5).toString('latin1') === '%PDF-',
};
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

// Los documentos subidos al contenedor privado se entregan con una URL
// firmada de 15 minutos; los del registro de la app ya son URLs de Cloudinary.
const withViewableUrl = async (doc) => {
  const d = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (d.source === 'upload' && d.fileUrl) d.fileUrl = await getBlobSasUrl(d.fileUrl, DOCUMENTS_CONTAINER, 15);
  return d;
};

// @desc   Subir un documento del vehículo (multipart: file + type)
// @route  POST /api/v1/vehicles/:id/documents
// @access Private (solo el conductor dueño del vehículo)
exports.uploadVehicleDocument = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select('driver_id');
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, message: 'No document file provided' });
    const type = String(file.mimetype || '').toLowerCase();
    if (!SIGNATURES[type] || !SIGNATURES[type](file.buffer)) {
      return res.status(400).json({ success: false, code: 'INVALID_FILE', message: 'File content does not match an allowed type (JPEG, PNG, WEBP, PDF)' });
    }
    if (!isBlobConfigured()) {
      return res.status(503).json({ success: false, code: 'STORAGE_NOT_CONFIGURED', message: 'Document storage is not configured on this server' });
    }

    const fileUrl = await uploadPrivateDocument(
      file.buffer,
      `doc-${vehicle._id}-${req.body.type}-${Date.now()}.${EXT[type]}`,
      type
    );
    const doc = await VehicleDocument.create({
      driver_id: vehicle.driver_id,
      vehicle_id: vehicle._id,
      type: req.body.type,
      fileUrl,
      mimeType: type,
      sizeBytes: file.size,
      source: 'upload',
    });
    res.status(201).json({ success: true, message: 'Document uploaded', data: await withViewableUrl(await VehicleDocument.findById(doc._id).select(PUBLIC_FIELDS)) });
  } catch (error) {
    next(error);
  }
};

// @desc   Borrar un documento propio (por id o por tipo: el panel manda el tipo)
// @route  DELETE /api/v1/vehicles/:id/documents/:docId
// @access Private (solo el conductor dueño; un documento aprobado no se borra)
exports.deleteVehicleDocument = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select('driver_id');
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const key = req.params.docId;
    const filter = mongoose.Types.ObjectId.isValid(key) && String(new mongoose.Types.ObjectId(key)) === key
      ? { _id: key, vehicle_id: vehicle._id }
      : { type: key, vehicle_id: vehicle._id };
    const doc = await VehicleDocument.findOne(filter).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    // Un documento aprobado es parte de la verificación del conductor:
    // borrarlo lo decide un admin, no el conductor.
    if (doc.status === 'approved') {
      return res.status(409).json({ success: false, code: 'DOCUMENT_APPROVED', message: 'Approved documents cannot be deleted' });
    }
    await VehicleDocument.deleteOne({ _id: doc._id, status: { $ne: 'approved' } });
    if (doc.source === 'upload') await deleteFromBlob(doc.fileUrl, DOCUMENTS_CONTAINER);
    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
};

// @desc   Documentos de un conductor
// @route  GET /api/v1/documents/driver/:id
// @access Private (admin o el propio conductor)
exports.getDocumentsByDriver = async (req, res, next) => {
  try {
    if (req.user.type !== 'admin' && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const docs = await VehicleDocument.find({ driver_id: req.params.id }).select(PUBLIC_FIELDS).sort({ createdAt: -1 }).limit(100);
    res.status(200).json({ success: true, data: await Promise.all(docs.map(withViewableUrl)) });
  } catch (error) {
    next(error);
  }
};

// @desc   Documentos que esperan revisión
// @route  GET /api/v1/documents/admin/pending?page&limit
// @access Private/Admin
exports.getPendingDocuments = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const query = { status: { $in: ['pending', 'processing', 'needs_review'] } };
    const [docs, total] = await Promise.all([
      VehicleDocument.find(query).select(PUBLIC_FIELDS).sort({ createdAt: 1 }).skip((page - 1) * limit).limit(limit),
      VehicleDocument.countDocuments(query),
    ]);
    res.status(200).json({
      success: true,
      data: await Promise.all(docs.map(withViewableUrl)),
      pagination: { total, page, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// @desc   Revisar un documento: approve | reject | request_resend
// @route  PATCH /api/v1/documents/:id/review
// @access Private/Admin
const REVIEW = {
  approve: { status: 'approved', resendRequested: false, audit: 'DOCUMENT_APPROVED' },
  reject: { status: 'rejected', resendRequested: false, audit: 'DOCUMENT_REJECTED' },
  request_resend: { status: 'rejected', resendRequested: true, audit: 'DOCUMENT_RESEND_REQUESTED' },
};
exports.reviewDocument = async (req, res, next) => {
  try {
    const { action, reason } = req.body;
    const r = REVIEW[action];
    const doc = await VehicleDocument.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          status: r.status,
          resendRequested: r.resendRequested,
          rejectionReason: action === 'approve' ? null : reason.trim(),
          reviewedBy: req.user._id,
          reviewedAt: new Date(),
        },
      },
      { new: true, runValidators: true }
    ).select(PUBLIC_FIELDS);
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    await recordAudit(req, {
      action: r.audit,
      targetType: 'VehicleDocument',
      targetId: doc._id,
      details: `Documento ${doc.type} del conductor ${doc.driver_id}: ${r.status}`,
    });
    res.status(200).json({ success: true, message: 'Document reviewed', data: await withViewableUrl(doc) });
  } catch (error) {
    next(error);
  }
};

// @desc   Volver a analizar un documento con el servicio automático
// @route  POST /api/v1/documents/:id/reprocess
// @access Private/Admin
// No hay servicio de análisis (OCR) configurado en este backend: se responde
// 503 con un código estable en lugar de simular un resultado.
exports.reprocessDocument = async (req, res, next) => {
  try {
    const exists = await VehicleDocument.exists({ _id: req.params.id });
    if (!exists) return res.status(404).json({ success: false, message: 'Document not found' });
    res.status(503).json({
      success: false,
      code: 'ANALYSIS_NOT_CONFIGURED',
      message: 'El análisis automático de documentos no está configurado en este servidor. Revisa el documento manualmente.',
    });
  } catch (error) {
    next(error);
  }
};

// Documento de póliza que llega con el registro del vehículo en la app
// (la app sube el certificado a Cloudinary y manda la URL). Solo se aceptan
// URLs https de res.cloudinary.com (validado también en la ruta).
const CLOUDINARY_URL = /^https:\/\/res\.cloudinary\.com\/[A-Za-z0-9_-]+\/(image|raw)\/upload\/[A-Za-z0-9_\-./%]+$/;
exports.isCloudinaryUrl = (u) => typeof u === 'string' && u.length <= 2048 && CLOUDINARY_URL.test(u) && !u.includes('..');
exports.createRegistrationDocument = async (vehicle, { insurance_certificate, policy_number, insurance_expiry }) => {
  if (!exports.isCloudinaryUrl(insurance_certificate)) return null;
  return VehicleDocument.create({
    driver_id: vehicle.driver_id,
    vehicle_id: vehicle._id,
    type: 'poliza',
    fileUrl: insurance_certificate,
    mimeType: /\.pdf$/i.test(insurance_certificate) ? 'application/pdf' : 'image/jpeg',
    source: 'app_registration',
    extractedData: {
      policyNumber: typeof policy_number === 'string' ? policy_number.slice(0, 40) : null,
      expiryDate: insurance_expiry && !Number.isNaN(Date.parse(insurance_expiry)) ? new Date(insurance_expiry).toISOString() : null,
    },
  });
};

exports.DOC_TYPES = DOC_TYPES;
