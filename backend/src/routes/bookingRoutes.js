const express = require('express');
const { body, query } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { verifyToken, authorize, requireActive } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

/**
 * @swagger
 * /bookings:
 *   get:
 *     summary: Obtener reservaciones
 *     description: Lista las reservaciones del usuario autenticado. Los administradores pueden ver todas.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PageParam'
 *       - $ref: '#/components/parameters/LimitParam'
 *       - name: status
 *         in: query
 *         description: Filtrar por estado de la reservación
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, cancelled, completed]
 *       - name: userId
 *         in: query
 *         description: ID del usuario (solo para administradores)
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reservaciones
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *   post:
 *     summary: Crear una reservación
 *     description: Reserva uno o más asientos en un viaje disponible
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ride_id
 *             properties:
 *               ride_id:
 *                 type: string
 *                 description: ID del viaje a reservar
 *                 example: "507f1f77bcf86cd799439013"
 *               seats_booked:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 description: Número de asientos a reservar
 *                 default: 1
 *                 example: 1
 *     responses:
 *       201:
 *         description: Reservación creada exitosamente
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
 *                   example: Booking created successfully
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: No hay suficientes asientos disponibles o el viaje no está disponible
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Viaje no encontrado
 *       409:
 *         description: Ya tienes una reservación para este viaje
 */

/**
 * @swagger
 * /bookings/{id}:
 *   get:
 *     summary: Obtener detalles de una reservación
 *     description: Retorna información detallada de una reservación específica
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Detalles de la reservación
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *   delete:
 *     summary: Cancelar una reservación
 *     description: Cancela una reservación existente y libera los asientos
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Reservación cancelada exitosamente
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
 *                   example: Booking cancelled successfully
 *       400:
 *         description: La reservación no puede ser cancelada
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
/**
 * @swagger
 * /bookings/{id}/canceled:
 *   patch:
 *     summary: Cancelar una reserva confirmada (conductor)
 *     description: 'Permite al conductor cancelar una reserva que ya fue confirmada. Devuelve los asientos al viaje y notifica al pasajero. Estado resultante: "canceled" (una l).'
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Reserva cancelada exitosamente
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
 *                   example: Booking canceled successfully
 *                 data:
 *                   $ref: '#/components/schemas/Booking'
 *       400:
 *         description: La reserva no está en estado "confirmed"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

// Validation rules
const bookingValidation = [
  body('ride_id').isString().isMongoId().withMessage('Invalid ride ID'),
  body('seats_booked').optional().isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
  // Mismo tope que el precio de un viaje (ruta y modelo).
  body('offered_amount').optional().isFloat({ min: 0, max: 250000 }).withMessage('offered_amount must be between 0 and 250000'),
  body('payment_method').optional({ nullable: true }).isIn(['cash', 'sinpe', 'card', 'paypal']).withMessage('Invalid payment method'),
  // Textos libres: tipo y largo. Un objeto reventaba en .trim() (500) y no
  // había tope de tamaño (el modelo también lo limita).
  body('passenger_origin').optional({ nullable: true }).isString().isLength({ max: 300 }),
  body('passenger_destination').optional({ nullable: true }).isString().isLength({ max: 300 }),
];

// All routes require authentication
router.use(verifyToken);

router.post('/', requireActive, bookingValidation, validate, bookingController.createBooking);
// Filtros del listado: valores cerrados y con tipo. El pasajero ve solo sus
// reservas; el resto de filtros (búsqueda, pago, fechas) es del panel.
const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'canceled', 'completed', 'deny'];
const listValidation = [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 1000 }),
  query('status').optional().isString().isIn(BOOKING_STATUSES),
  query('payment_status').optional().isString().isIn(['pending', 'paid', 'waived']),
  query('payment_type').optional().isString().isIn(['normal', 'gifted']),
  query('payment_method').optional().isString().isIn(['cash', 'sinpe', 'paypal', 'card', 'google_pay', 'apple_pay']),
  query('from').optional().isString().isISO8601(),
  query('to').optional().isString().isISO8601(),
  query('search').optional().isString().trim().isLength({ max: 60 }),
  query('sort').optional().isString().isIn(['asc', 'desc']),
  query('userId').optional().isString().isMongoId(),
];
router.get('/', listValidation, validate, bookingController.getAllBookings);
// Totales para la página de Pagos del panel. Antes de /:id.
router.get('/admin/summary', authorize('admin'), [
  query('from').optional().isString().isISO8601(),
  query('to').optional().isString().isISO8601(),
], validate, bookingController.getBookingsSummary);
router.get('/:id', bookingController.getBookingById);
router.get('/passenger/:passengerId', bookingController.getBookingsByPassenger);
router.get('/ride/:rideId', bookingController.getBookingsByRide);
// Todas las reservas de los viajes del conductor autenticado en una sola
// consulta (métricas del conductor). ?rideStatus=completed filtra por estado del viaje.
router.get('/driver/me', authorize('conductor'), bookingController.getMyDriverBookings);
router.delete('/:id', bookingController.cancelBooking);
router.patch('/:id/canceled', bookingController.canceledBooking);
// Solo estados conocidos y de tipo texto: un objeto o un array no llega al
// controlador (que además comprueba quién puede hacer cada transición).
const statusValidation = [
  body('status').isString().isIn(['pending', 'confirmed', 'cancelled', 'canceled', 'completed', 'deny'])
    .withMessage('Invalid status'),
  body('apply_penalty').optional().isBoolean({ strict: true }),
];
router.patch('/:id/status', authorize('conductor', 'admin', 'pasajero'), statusValidation, validate, bookingController.updateBookingStatus);
router.patch('/:id/payment', authorize('conductor', 'admin'), bookingController.updatePaymentStatus);

module.exports = router;