const express = require('express');
const { body } = require('express-validator');
const reviewController = require('../controllers/reviewController');
const { verifyToken, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const reviewValidation = [
  body('ride_id').isMongoId().withMessage('Invalid ride ID'),
  body('reviewee_id').isMongoId().withMessage('Invalid reviewee ID'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().trim().isLength({ max: 500 }).withMessage('Comment cannot exceed 500 characters'),
];

// Public routes (with optional auth)
/**
 * @swagger
 * /reviews/user/{userId}:
 *   get:
 *     summary: Obtener reseñas de un usuario
 *     description: Retorna las reseñas recibidas por un usuario
 *     tags: [Reviews]
 *     security: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reseñas
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
 *                         $ref: '#/components/schemas/Review'
 */
router.get('/user/:userId', optionalAuth, reviewController.getReviewsByUser);

// Protected routes
router.use(verifyToken);

/**
 * @swagger
 * /reviews:
 *   post:
 *     summary: Crear reseña
 *     description: Crea una nueva reseña para un viaje completado
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ride_id, reviewee_id, rating]
 *             properties:
 *               ride_id:
 *                 type: string
 *               reviewee_id:
 *                 type: string
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *     responses:
 *       201:
 *         description: Reseña creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Review'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post('/', reviewValidation, validate, reviewController.createReview);

/**
 * @swagger
 * /reviews/ride/{rideId}:
 *   get:
 *     summary: Obtener reseñas de un viaje
 *     description: Retorna las reseñas asociadas a un viaje específico
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: rideId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reseñas del viaje
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
 *                         $ref: '#/components/schemas/Review'
 */
router.get('/ride/:rideId', reviewController.getReviewsByRide);

/**
 * @swagger
 * /reviews/{id}:
 *   delete:
 *     summary: Eliminar reseña
 *     description: Elimina una reseña (requiere ser el autor o administrador)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/IdParam'
 *     responses:
 *       200:
 *         description: Reseña eliminada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete('/:id', reviewController.deleteReview);

module.exports = router;