const express = require('express');
const { body } = require('express-validator');
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
  body('ride_id').isMongoId().withMessage('Invalid ride ID'),
  body('seats_booked').optional().isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
  body('offered_amount').optional().isFloat({ min: 0 }).withMessage('offered_amount must be a non-negative number'),
];

// All routes require authentication
router.use(verifyToken);

router.post('/', requireActive, bookingValidation, validate, bookingController.createBooking);
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.get('/passenger/:passengerId', bookingController.getBookingsByPassenger);
router.get('/ride/:rideId', bookingController.getBookingsByRide);
router.delete('/:id', bookingController.cancelBooking);
router.patch('/:id/canceled', bookingController.canceledBooking);
router.patch('/:id/status', authorize('conductor', 'admin', 'pasajero'), bookingController.updateBookingStatus);
router.patch('/:id/payment', authorize('conductor', 'admin'), bookingController.updatePaymentStatus);

module.exports = router;