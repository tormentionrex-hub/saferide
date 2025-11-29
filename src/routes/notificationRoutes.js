const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const notificationValidation = [
  body('user_id').isMongoId().withMessage('Invalid user ID'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').isIn(['booking_confirmed', 'booking_cancelled', 'ride_reminder', 'ride_completed', 'review_request', 'system']),
];

// All routes require authentication
router.use(verifyToken);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Obtener notificaciones
 *     description: Retorna las notificaciones del usuario autenticado
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de notificaciones
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
 *                         $ref: '#/components/schemas/Notification'
 */
router.get('/', notificationController.getNotifications);

/**
 * @swagger
 * /notifications/{id}/read:
 *   patch:
 *     summary: Marcar notificación como leída
 *     description: Actualiza el estado de una notificación a "read"
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Notificación marcada como leída
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch('/:id/read', notificationController.markAsRead);

/**
 * @swagger
 * /notifications/read-all:
 *   patch:
 *     summary: Marcar todas como leídas
 *     description: Marca todas las notificaciones del usuario como leídas
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas las notificaciones marcadas como leídas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.patch('/read-all', notificationController.markAllAsRead);

/**
 * @swagger
 * /notifications/{id}:
 *   delete:
 *     summary: Eliminar notificación
 *     description: Elimina una notificación del sistema
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Notificación eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', notificationController.deleteNotification);

/**
 * @swagger
 * /notifications:
 *   post:
 *     summary: Crear notificación (Admin)
 *     description: Crea una notificación manual para un usuario (requiere rol de administrador)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id, message, type]
 *             properties:
 *               user_id:
 *                 type: string
 *               message:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [booking_confirmed, booking_cancelled, ride_reminder, ride_completed, review_request, system]
 *     responses:
 *       201:
 *         description: Notificación creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Notification'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', authorize('administrador'), notificationValidation, validate, notificationController.createNotification);

module.exports = router;