const { Document, AuditLog } = require('../models');
const documentValidationService = require('../services/documentValidationService');
const { syncVehicleApproval, getPendingDriversCount } = require('../services/vehicleApprovalService');

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

    const [documents, count, pendingDrivers] = await Promise.all([
      Document.find(query)
        .populate('driver_id', 'name email username')
        .sort({ createdAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit)),
      Document.countDocuments(query),
      getPendingDriversCount(),
    ]);

    res.status(200).json({
      success: true,
      data: documents,
      stats: { pendingDrivers },
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
    const vehicleApproval = await syncVehicleApproval(document.driver_id);

    res.status(200).json({
        success: true,
        message: 'Documento actualizado',
        data: document,
        vehicleApproval,
    });
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

    await documentValidationService.validateDocument(document);
    await document.save();

    await recordAudit(req, 'DOCUMENT_REPROCESSED', `Validó ${document.type} ${document._id} con ${document.validation.source}`);
    const vehicleApproval = await syncVehicleApproval(document.driver_id);

    res.status(200).json({
        success: true,
        message: 'Documento validado',
        data: document,
        vehicleApproval,
    });
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Subida de documentos desde la app (conductor dueño del vehículo). Usan el
// mismo modelo Document que revisa el panel, así la app y el panel ven la
// misma colección.
// ---------------------------------------------------------------------------
const mongoose = require('mongoose');
const { Vehicle } = require('../models');
const { isBlobConfigured, uploadPrivateDocument, deleteFromBlob, DOCUMENTS_CONTAINER } = require('../services/blobService');

const DOC_TYPES = Document.schema.path('type').enumValues;

// El contenido real del archivo debe coincidir con el tipo que declara el
// cliente (multer solo ve el mimetype que manda el cliente).
const SIGNATURES = {
  'image/jpeg': (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) => b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (b) => b.length > 12 && b.slice(0, 4).toString('latin1') === 'RIFF' && b.slice(8, 12).toString('latin1') === 'WEBP',
  'application/pdf': (b) => b.length > 5 && b.slice(0, 5).toString('latin1') === '%PDF-',
};
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

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
    const doc = await Document.create({
      driver_id: vehicle.driver_id,
      vehicle_id: vehicle._id,
      type: req.body.type,
      fileUrl,
      mimeType: type,
      sizeBytes: file.size,
      source: 'upload',
    });
    res.status(201).json({ success: true, message: 'Document uploaded', data: doc });
  } catch (error) {
    next(error);
  }
};

// @desc   Borrar un documento propio (por id o por tipo)
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
      ? { _id: key, driver_id: vehicle.driver_id }
      : { type: key, driver_id: vehicle.driver_id };
    const doc = await Document.findOne(filter).sort({ createdAt: -1 });
    if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
    // Un documento aprobado es parte de la verificación del conductor:
    // borrarlo lo decide un admin, no el conductor.
    if (doc.status === 'approved') {
      return res.status(409).json({ success: false, code: 'DOCUMENT_APPROVED', message: 'Approved documents cannot be deleted' });
    }
    await Document.deleteOne({ _id: doc._id, status: { $ne: 'approved' } });
    if (doc.source === 'upload') await deleteFromBlob(doc.fileUrl, DOCUMENTS_CONTAINER);
    res.status(200).json({ success: true, message: 'Document deleted' });
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
  return Document.create({
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

// ---------------------------------------------------------------------------
// Documentos que el conductor registra desde la app: la app sube la foto a
// Cloudinary (igual que el certificado de la póliza) y aquí se guarda la URL
// con los datos que declara. Se valida al momento con el motor de reglas y se
// sincroniza la aprobación del vehículo (se activa con los 6 aprobados).
// ---------------------------------------------------------------------------

// Datos que acepta cada tipo (los que lee documentValidationService).
const EXTRACTED_FIELDS = {
  cedula: ['documentNumber', 'fullName', 'expiryDate'],
  licencia: ['licenseNumber', 'licenseClass', 'fullName', 'documentNumber', 'expiryDate'],
  poliza: ['policyNumber', 'insurer', 'policyHolder', 'licensePlate', 'expiryDate'],
  marchamo: ['licensePlate', 'vehicleBrand', 'vehicleModel', 'vehicleYear', 'marchamoYear', 'expiryDate'],
  rtv: ['rtvNumber', 'licensePlate', 'vehicleBrand', 'vehicleModel', 'expiryDate'],
  tarjeta_circulacion: ['fullName', 'licensePlate', 'vehicleBrand', 'vehicleModel'],
};
exports.EXTRACTED_FIELDS = EXTRACTED_FIELDS;

// Solo los campos del tipo, como texto corto y sin < > ni caracteres de control.
const cleanExtractedData = (type, data) => {
  const out = {};
  for (const key of EXTRACTED_FIELDS[type] || []) {
    const value = data?.[key];
    if (value === undefined || value === null || value === '') continue;
    const text = String(value).trim().slice(0, 80);
    if (text && !/[<>\u0000-\u001F\u007F]/.test(text)) out[key] = text;
  }
  return out;
};

// @desc   Registrar un documento con la URL de Cloudinary que subió la app
// @route  POST /api/v1/vehicles/:id/documents/url
// @access Private (solo el conductor dueño del vehículo)
exports.registerDocumentByUrl = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select('driver_id');
    if (!vehicle) return res.status(404).json({ success: false, message: 'Vehicle not found' });
    if (vehicle.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { type, fileUrl } = req.body;
    // Un documento aprobado no se reemplaza desde la app: lo decide un admin.
    const latest = await Document.findOne({ driver_id: vehicle.driver_id, type }).sort({ createdAt: -1, _id: -1 });
    if (latest?.status === 'approved') {
      return res.status(409).json({ success: false, code: 'DOCUMENT_APPROVED', message: 'Este documento ya está aprobado' });
    }
    const document = new Document({
      driver_id: vehicle.driver_id,
      vehicle_id: vehicle._id,
      type,
      fileUrl,
      mimeType: /\.pdf$/i.test(fileUrl) ? 'application/pdf' : 'image/jpeg',
      source: 'app_registration',
      extractedData: cleanExtractedData(type, req.body.extractedData),
    });
    await documentValidationService.validateDocument(document);
    await document.save();
    // Los envíos anteriores del mismo tipo que seguían esperando revisión ya no
    // aplican: se cierran para que no queden en la cola del administrador.
    await Document.updateMany(
      { driver_id: vehicle.driver_id, type, _id: { $ne: document._id }, status: { $in: ['pending', 'processing', 'needs_review'] } },
      { $set: { status: 'rejected', rejectionReason: 'Reemplazado por un envío más reciente' } }
    );
    const vehicleApproval = await syncVehicleApproval(vehicle.driver_id, vehicle._id);
    res.status(201).json({
      success: true,
      message: 'Documento registrado',
      data: {
        _id: document._id,
        type: document.type,
        status: document.status,
        rejectionReason: document.rejectionReason,
        extractedData: document.extractedData,
        createdAt: document.createdAt,
      },
      approval: { approved: vehicleApproval.approved, details: vehicleApproval.details },
    });
  } catch (error) {
    next(error);
  }
};
