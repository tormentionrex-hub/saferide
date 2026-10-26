const express = require('express');
const { body } = require('express-validator');
const rideController = require('../controllers/rideController');
const { verifyToken, authorize, optionalAuth, requireActive } = require('../middleware/auth');
const validate = require('../middleware/validation');
const tz = require('../utils/timeZone');

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
 *           enum: [scheduled, in progress, awaiting_payment_verification, completed, cancelled]
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
 *                   fecha: "2024-12-15"
 *                   hora: "07:00"
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
 *               - fecha
 *               - hora
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
 *               fecha:
 *                 type: string
 *                 format: date
 *               hora:
 *                 type: string
 *                 example: "08:00"
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
 *     description: Cambia el estado de un viaje a "in progress" (solo el conductor)
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
  body('fecha')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value) => {
      const nowDateString = tz.now().toFormat('yyyy-MM-dd');
      if (value !== nowDateString) {
        throw new Error('Solo puedes crear o gestionar viajes para el día de hoy');
      }
      return true;
    }),
  body('hora')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora inválido (HH:mm)')
    .custom((value, { req }) => {
      if (!req.body.fecha) return false;
      
      const nowLuxon = tz.now();
      const [year, month, day] = req.body.fecha.split('-').map(Number);
      const [h, m] = value.split(':').map(Number);
      
      const valTime = nowLuxon.set({ year, month: month, day, hour: h, minute: m, second: 0, millisecond: 0 });
      const minAllowed = nowLuxon.plus({ minutes: 5 }).set({ second: 0, millisecond: 0 });

      console.log(`[Validation Debug] nowLuxon: ${nowLuxon.toISO()}`);
      console.log(`[Validation Debug] valTime: ${valTime.toISO()}`);
      console.log(`[Validation Debug] minAllowed: ${minAllowed.toISO()}`);

      if (valTime < minAllowed) {
        throw new Error('Debes programar el viaje con al menos 5 minutos de anticipación.');
      }
      return true;
    }),
  body('available_seats').isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
  body('distance_km').optional().isFloat({ min: 0 }),
  body('duration_minutes').optional().isInt({ min: 0 }),
];

// Public routes (with optional auth)
router.get('/', optionalAuth, rideController.getAllRides);
router.get('/:id', optionalAuth, rideController.getRideById);

// Protected routes
router.use(verifyToken);

router.post('/', authorize('conductor'), requireActive, rideValidation, validate, rideController.createRide);
/**
 * @swagger
 * /rides/{id}:
 *   put:
 *     summary: Actualizar viaje
 *     description: Actualiza los detalles de un viaje programado (solo el conductor)
 *     tags: [Rides]
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
 *               available_seats:
 *                 type: integer
 *               fecha:
 *                 type: string
 *                 format: date
 *               hora:
 *                 type: string
 *                 example: "08:00"
 *     responses:
 *       200:
 *         description: Viaje actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Ride'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
const updateRideValidation = [
  body('fecha').optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Formato de fecha inválido (YYYY-MM-DD)')
    .custom((value) => {
      const nowDateString = tz.now().toFormat('yyyy-MM-dd');
      if (value !== nowDateString) {
        throw new Error('Solo puedes crear o gestionar viajes para el día de hoy');
      }
      return true;
    }),
  body('hora').optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Formato de hora inválido (HH:mm)')
    .custom((value, { req }) => {
      const fechaToCheck = req.body.fecha || tz.now().toFormat('yyyy-MM-dd');
      
      const nowLuxon = tz.now();
      const [year, month, day] = fechaToCheck.split('-').map(Number);
      const [h, m] = value.split(':').map(Number);
      
      const valTime = nowLuxon.set({ year, month: month, day, hour: h, minute: m, second: 0, millisecond: 0 });
      const minAllowed = nowLuxon.plus({ minutes: 5 }).set({ second: 0, millisecond: 0 });

      console.log(`[Validation Debug] nowLuxon: ${nowLuxon.toISO()}`);
      console.log(`[Validation Debug] valTime: ${valTime.toISO()}`);
      console.log(`[Validation Debug] minAllowed: ${minAllowed.toISO()}`);

      if (valTime < minAllowed) {
        throw new Error('Debes programar el viaje con al menos 5 minutos de anticipación.');
      }
      return true;
    }),
  body('available_seats').optional().isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
];

router.put('/:id', authorize('conductor'), updateRideValidation, validate, rideController.updateRide);

/**
 * @swagger
 * /rides/{id}/cancel:
 *   patch:
 *     summary: Cancelar viaje
 *     description: Cancela un viaje programado y notifica a los pasajeros (solo el conductor)
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Viaje cancelado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/cancel', authorize('conductor'), rideController.cancelRide);

/**
 * @swagger
 * /rides/driver/{driverId}:
 *   get:
 *     summary: Obtener viajes por conductor
 *     description: Retorna el historial de viajes de un conductor
 *     tags: [Rides]
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
 *         description: Lista de viajes del conductor
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
 *                         $ref: '#/components/schemas/Ride'
 */
router.get('/driver/:driverId', rideController.getRidesByDriver);
router.patch('/:id/start', authorize('conductor'), rideController.startRide);
router.patch('/:id/complete', authorize('conductor'), rideController.completeRide);
// Paso 2 del cierre del viaje. Lo dispara PaymentVerification al apretar
// "Continuar": completa el ride y los bookings, dispara métricas y notifs.
router.patch(
  '/:id/finalize-payment-verification',
  authorize('conductor'),
  rideController.finalizePaymentVerification
);

module.exports = router;