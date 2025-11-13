const express = require('express');
const metricsController = require('../controllers/metricsController');
const { verifyToken, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();
/**
 * @swagger
 * /metrics/user/{userId}:
 *   get:
 *     summary: Obtener métricas de un usuario
 *     description: Retorna métricas de sostenibilidad de un usuario específico
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID del usuario
 *         schema:
 *           type: string
 *       - name: period
 *         in: query
 *         description: Período de las métricas
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly, total]
 *           default: total
 *     responses:
 *       200:
 *         description: Métricas del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Metrics'
 *             example:
 *               success: true
 *               data:
 *                 _id: "507f1f77bcf86cd799439017"
 *                 user_id: "507f1f77bcf86cd799439011"
 *                 kilometers_driven: 245.8
 *                 carbon_footprint: 35.2
 *                 total_rides: 15
 *                 total_passengers: 42
 *                 period: "total"
 *                 date: "2024-11-08T02:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         description: No se encontraron métricas para este usuario
 */

/**
 * @swagger
 * /metrics/leaderboard:
 *   get:
 *     summary: Obtener tabla de líderes
 *     description: Retorna los usuarios con mayores contribuciones de sostenibilidad
 *     tags: [Metrics]
 *     security: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Número de usuarios a mostrar
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *       - name: sortBy
 *         in: query
 *         description: Campo por el cual ordenar
 *         schema:
 *           type: string
 *           enum: [carbon_footprint, kilometers_driven, total_rides, total_passengers]
 *           default: carbon_footprint
 *     responses:
 *       200:
 *         description: Tabla de líderes
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Metrics'
 *                       - type: object
 *                         properties:
 *                           user_id:
 *                             type: object
 *                             description: Información del usuario
 *                             properties:
 *                               name:
 *                                 type: string
 *                               username:
 *                                 type: string
 *                               profileImage:
 *                                 type: string
 *                               rating:
 *                                 type: number
 */

/**
 * @swagger
 * /metrics/global:
 *   get:
 *     summary: Obtener métricas globales
 *     description: Retorna métricas agregadas de todo el sistema (solo administradores)
 *     tags: [Metrics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Métricas globales del sistema
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalKilometers:
 *                       type: number
 *                       example: 5420.5
 *                     totalCarbonSaved:
 *                       type: number
 *                       example: 780.3
 *                     totalRides:
 *                       type: integer
 *                       example: 245
 *                     totalPassengers:
 *                       type: integer
 *                       example: 680
 *                     totalUsers:
 *                       type: integer
 *                       example: 150
 *                     totalDrivers:
 *                       type: integer
 *                       example: 45
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
// Public routes
router.get('/leaderboard', optionalAuth, metricsController.getLeaderboard);

// Protected routes
router.use(verifyToken);

router.get('/user/:userId', metricsController.getUserMetrics);
router.post('/calculate/:userId', authorize('administrador'), metricsController.calculateMetrics);
router.get('/global', authorize('administrador'), metricsController.getGlobalMetrics);

module.exports = router;