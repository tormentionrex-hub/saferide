const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const vehicleController = require('../controllers/vehicleController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { isSafeText, SAFE_TEXT_MESSAGE } = require('../utils/safeText');
const { param } = require('express-validator');
const documentController = require('../controllers/documentController');
const { isCloudinaryUrl, DOC_TYPES } = documentController;

const router = express.Router();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Imágenes sí, SVG no: es XML con scripts y el blob se publica con el
    // content-type que manda el cliente. El error lleva 400 (no 500).
    const type = String(file.mimetype || '').toLowerCase();
    if (type.startsWith('image/') && !type.includes('svg') && !type.includes('xml')) {
      cb(null, true);
    } else {
      const err = new Error('Only image files are allowed');
      err.statusCode = 400;
      cb(err);
    }
  },
});

// Validation rules
// isString en los textos: sin validar el tipo, license_plate: ['ABC123']
// llegaba al controlador y reventaba en .toUpperCase() con un 500.
// isSafeText: marca, modelo y color no admiten < > ni caracteres de control.
const vehicleValidation = [
  body('brand').isString().trim().notEmpty().isLength({ max: 50 }).withMessage('Brand is required').custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('model').isString().trim().notEmpty().isLength({ max: 50 }).withMessage('Model is required').custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('license_plate')
    .customSanitizer((value) => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6))
    .matches(/^(?=.*[0-9])[A-Z0-9]{6}$/)
    .withMessage('La placa debe tener 6 caracteres alfanuméricos e incluir al menos un número'),
  body('color').isString().trim().notEmpty().isLength({ max: 30 }).withMessage('Color is required').custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  // Datos de la póliza que manda la app al registrar el vehículo (antes se
  // ignoraban). El certificado solo se acepta como URL https de Cloudinary,
  // que es donde la app lo sube; queda como documento 'poliza' pendiente.
  body('insurance_certificate').optional({ nullable: true }).custom(isCloudinaryUrl)
    .withMessage('insurance_certificate must be a Cloudinary https URL'),
  body('policy_number').optional({ nullable: true }).isString().trim().isLength({ max: 40 })
    .custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('insurance_expiry').optional({ nullable: true }).isString().isISO8601(),
];

// Documentos del vehículo: imágenes (sin SVG) o PDF, hasta 5 MB. El
// controlador además comprueba los primeros bytes del archivo.
const DOC_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const uploadDocument = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (req, file, cb) => {
    if (DOC_MIMES.includes(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    const err = new Error('Only JPEG, PNG, WEBP or PDF files are allowed');
    err.statusCode = 400;
    cb(err);
  },
});
// Un archivo de más de 5 MB es un 413 claro, no un 500.
const documentUpload = (req, res, next) => uploadDocument.single('file')(req, res, (err) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, message: 'File too large (max 5 MB)' });
  if (err && err.name === 'MulterError') return res.status(400).json({ success: false, message: 'Invalid upload' });
  next(err);
});
const documentUploadValidation = [
  param('id').isMongoId().withMessage('Invalid vehicle ID'),
  body('type').isString().isIn(DOC_TYPES).withMessage('Invalid document type'),
];
const documentDeleteValidation = [
  param('id').isMongoId().withMessage('Invalid vehicle ID'),
  param('docId').custom((v) => /^[0-9a-f]{24}$/i.test(v) || DOC_TYPES.includes(v)).withMessage('Invalid document'),
];

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /vehicles:
 *   post:
 *     summary: Registrar vehículo
 *     description: Registra un nuevo vehículo para un conductor (requiere rol de conductor)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [brand, model, license_plate, color, year]
 *             properties:
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               license_plate:
 *                 type: string
 *               color:
 *                 type: string
 *               capacity:
 *                 type: integer
 *               year:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Vehículo registrado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Vehicle'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', authorize('conductor', 'admin'), vehicleValidation, validate, vehicleController.createVehicle);

/**
 * @swagger
 * /vehicles/driver/{driverId}:
 *   get:
 *     summary: Obtener vehículos por conductor
 *     description: Retorna la lista de vehículos registrados por un conductor
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: driverId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de vehículos del conductor
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Vehicle'
 */
// Estado del vehículo propio y de sus 6 documentos (antes de '/:id').
router.get('/me/approval', authorize('conductor'), vehicleController.getMyVehicleApproval);

router.get('/driver/:driverId', vehicleController.getVehicleByDriver);

/**
 * @swagger
 * /vehicles/{id}:
 *   get:
 *     summary: Obtener vehículo por ID
 *     description: Retorna los detalles de un vehículo específico
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detalles del vehículo
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Vehicle'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get('/:id', vehicleController.getVehicleById);

/**
 * @swagger
 * /vehicles/{id}:
 *   put:
 *     summary: Actualizar vehículo
 *     description: Actualiza los datos de un vehículo existente (requiere rol de conductor)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *               model:
 *                 type: string
 *               color:
 *                 type: string
 *               year:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Vehículo actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Vehicle'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
// Mismos tipos al editar (todo opcional).
const vehicleUpdateValidation = [
  body('brand').optional().isString().trim().notEmpty().isLength({ max: 50 })
    .custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('model').optional().isString().trim().notEmpty().isLength({ max: 50 })
    .custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('license_plate').optional().isString().matches(/^[A-Z0-9]{6}$/),
  body('color').optional().isString().trim().notEmpty().isLength({ max: 30 })
    .custom(isSafeText).withMessage(SAFE_TEXT_MESSAGE),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
  body('capacity').optional().isInt({ min: 1, max: 7 }),
];
router.put('/:id', authorize('conductor', 'admin'), vehicleUpdateValidation, validate, vehicleController.updateVehicle);

/**
 * @swagger
 * /vehicles/{id}/image:
 *   post:
 *     summary: Subir imagen del vehículo
 *     description: Sube una imagen para el vehículo (requiere rol de conductor)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Imagen actualizada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         imageUrl:
 *                           type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/:id/image', authorize('conductor', 'admin'), upload.single('image'), vehicleController.uploadVehicleImage);

/**
 * @swagger
 * /vehicles/{id}:
 *   delete:
 *     summary: Eliminar vehículo
 *     description: Elimina un vehículo del sistema
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Vehículo eliminado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', vehicleController.deleteVehicle);

// Documentos del vehículo: solo el conductor dueño sube y borra (el
// controlador lo comprueba); la revisión es de admin en /documents.
router.post('/:id/documents', authorize('conductor'), documentUpload, documentUploadValidation, validate, documentController.uploadVehicleDocument);
// Documento cuya foto la app ya subió a Cloudinary (no necesita Azure Blob).
const documentUrlValidation = [
  param('id').isMongoId().withMessage('Invalid vehicle ID'),
  body('type').isString().isIn(DOC_TYPES).withMessage('Invalid document type'),
  body('fileUrl').custom(isCloudinaryUrl).withMessage('fileUrl must be a Cloudinary https URL'),
  body('extractedData').optional({ nullable: true }).custom((v) => v && typeof v === 'object' && !Array.isArray(v)).withMessage('extractedData must be an object'),
];
router.post('/:id/documents/url', authorize('conductor'), documentUrlValidation, validate, documentController.registerDocumentByUrl);
router.delete('/:id/documents/:docId', authorize('conductor'), documentDeleteValidation, validate, documentController.deleteVehicleDocument);

/**
 * @swagger
 * /vehicles:
 *   get:
 *     summary: Obtener todos los vehículos (Admin)
 *     description: Retorna una lista de todos los vehículos registrados (requiere rol de admin)
 *     tags: [Vehicles]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authorize('admin'), vehicleController.getAllVehicles);

/**
 * @swagger
 * /vehicles/{id}/status:
 *   patch:
 *     summary: Aprobar/Desactivar vehículo (Admin)
 *     description: Cambia el estado isActive de un vehículo. Admin puede activar/desactivar cualquier vehículo. Conductor solo puede desactivar su propio vehículo.
 *     tags: [Vehicles]
 */
router.patch('/:id/status', authorize('conductor', 'admin'), vehicleController.updateVehicleStatus);

module.exports = router;
