const express = require('express');
const { body } = require('express-validator');
const rideController = require('../controllers/rideController');
const { verifyToken, authorize, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /rides:
 *   get:
 *     summary: Buscar viajes disponibles
 *     description: Busca viajes con filtros opcionales de ubicación, fecha y asientos disponibles
 *     tags: [Rides]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: origin
 *         in: query
 *         description: Coordenadas de origen (lat,lng) - búsqueda aproximada en un radio de 5km
 *         schema:
 *           type: string
 *           example: "10.0162,-84.2119"
 *       - name: destination
 *         in: query
 *         description: Coordenadas de destino (lat,lng) - búsqueda aproximada en un radio de 5km
 *         schema:
 *           type: string
 *           example: "9.9281,-84.0907"
 *       - name: date
 *         in: query
 *         description: Fecha del viaje (YYYY-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-15"
 *       - name: minSeats
 *         in: query
 *         description: Número mínimo de asientos disponibles
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 2
 *       - name: status
 *         in: query
 *         description: Estado del viaje
 *         schema:
 *           type: string
 *           enum: [scheduled, in_progress, completed, cancelled]
 *           default: scheduled
 *     responses:
 *       200:
 *         description: Lista de viajes encontrados
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Ride'
 *             example:
 *               success: true
 *               data:
 *                 - _id: "507f1f77bcf86cd799439013"
 *                   driver_id:
 *                     _id: "507f1f77bcf86cd799439011"
 *                     name: "Carlos Rodríguez"
 *                     username: "carlosdriver"
 *                     rating: 4.8
 *                     profileImage: "https://stsaferidedev.blob.core.windows.net/profile-images/profile-123.jpg"
 *                   origin:
 *                     name: "Alajuela Centro"
 *                     coordinates:
 *                       lat: 10.0162
 *                       lng: -84.2119
 *                   destination:
 *                     name: "San José Centro"
 *                     coordinates:
 *                       lat: 9.9281
 *                       lng: -84.0907
 *                   date_time: "2024-12-15T07:00:00.000Z"
 *                   available_seats: 3
 *                   status: "scheduled"
 *                   distance_km: 25.5
 *                   duration_minutes: 45
 *               pagination:
 *                 total: 15
 *                 page: 1
 *                 limit: 10
 *                 pages: 2
 *   post:
 *     summary: Crear un nuevo viaje
 *     description: Permite a un conductor crear un nuevo viaje (requiere rol de conductor)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - origin
 *               - destination
 *               - date_time
 *               - available_seats
 *             properties:
 *               origin:
 *                 type: object
 *                 required:
 *                   - name
 *                   - coordinates
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "Alajuela Centro"
 *                   coordinates:
 *                     type: object
 *                     required:
 *                       - lat
 *                       - lng
 *                     properties:
 *                       lat:
 *                         type: number
 *                         example: 10.0162
 *                       lng:
 *                         type: number
 *                         example: -84.2119
 *               destination:
 *                 type: object
 *                 required:
 *                   - name
 *                   - coordinates
 *                 properties:
 *                   name:
 *                     type: string
 *                     example: "San José Centro"
 *                   coordinates:
 *                     type: object
 *                     properties:
 *                       lat:
 *                         type: number
 *                         example: 9.9281
 *                       lng:
 *                         type: number
 *                         example: -84.0907
 *               date_time:
 *                 type: string
 *                 format: date-time
 *                 description: Fecha y hora del viaje (debe ser futura)
 *                 example: "2024-12-15T07:00:00.000Z"
 *               available_seats:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 description: Número de asientos disponibles
 *                 example: 3
 *               distance_km:
 *                 type: number
 *                 description: Distancia del viaje en kilómetros (opcional)
 *                 example: 25.5
 *               duration_minutes:
 *                 type: integer
 *                 description: Duración estimada en minutos (opcional)
 *                 example: 45
 *     responses:
 *       201:
 *         description: Viaje creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ride created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Ride'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Solo conductores pueden crear viajes
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Only conductors can create rides
 */

/**
 * @swagger
 * /rides/{id}:
 *   get:
 *     summary: Obtener detalles de un viaje
 *     description: Retorna información detallada de un viaje específico, incluyendo conductor y reservaciones
 *     tags: [Rides]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detalles del viaje
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Ride'
 *                     - type: object
 *                       properties:
 *                         driver_id:
 *                           type: object
 *                           description: Información completa del conductor
 *                         bookings:
 *                           type: array
 *                           description: Lista de reservaciones para este viaje
 *                           items:
 *                             $ref: '#/components/schemas/Booking'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /rides/{id}/start:
 *   patch:
 *     summary: Iniciar un viaje
 *     description: Cambia el estado de un viaje a "in_progress" (solo el conductor)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Viaje iniciado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ride started successfully
 *                 data:
 *                   $ref: '#/components/schemas/Ride'
 *       400:
 *         description: El viaje no puede ser iniciado
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /rides/{id}/complete:
 *   patch:
 *     summary: Completar un viaje
 *     description: Marca un viaje como completado y actualiza las reservaciones (solo el conductor)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Viaje completado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Ride completed successfully
 *                 data:
 *                   $ref: '#/components/schemas/Ride'
 *       400:
 *         description: El viaje no está en progreso
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */

// Validation rules
const rideValidation = [
  body('origin.name').trim().notEmpty().withMessage('Origin name is required'),
  body('origin.coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('origin.coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('destination.name').trim().notEmpty().withMessage('Destination name is required'),
  body('destination.coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('destination.coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('date_time').isISO8601().withMessage('Invalid date format'),
  body('available_seats').isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
  body('distance_km').optional().isFloat({ min: 0 }),
  body('duration_minutes').optional().isInt({ min: 0 }),
];

// Public routes (with optional auth)
router.get('/', optionalAuth, rideController.getAllRides);
router.get('/:id', optionalAuth, rideController.getRideById);

// Protected routes
router.use(verifyToken);

router.post('/', authorize('conductor'), rideValidation, validate, rideController.createRide);
router.put('/:id', authorize('conductor'), rideController.updateRide);
router.delete('/:id', authorize('conductor'), rideController.cancelRide);
router.get('/driver/:driverId', rideController.getRidesByDriver);
router.patch('/:id/start', authorize('conductor'), rideController.startRide);
router.patch('/:id/complete', authorize('conductor'), rideController.completeRide);

module.exports = router;