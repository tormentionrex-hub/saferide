const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const vehicleController = require('../controllers/vehicleController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Validation rules
const vehicleValidation = [
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('license_plate').matches(/^[A-Z0-9]{6}$/).withMessage('License plate must be 6 characters'),
  body('color').trim().notEmpty().withMessage('Color is required'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
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
router.post('/', authorize('conductor'), vehicleValidation, validate, vehicleController.createVehicle);

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
router.put('/:id', authorize('conductor'), vehicleController.updateVehicle);

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
router.post('/:id/image', authorize('conductor'), upload.single('image'), vehicleController.uploadVehicleImage);

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

module.exports = router;
