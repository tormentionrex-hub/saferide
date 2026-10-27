/**
 * reviewsRoutes.js — Rutas del agente para consultar reviews con clasificación.
 *
 * Se monta desde src/routes/index.js del backend:
 *
 *   // [SAFESCORE-AGENT]
 *   try {
 *     const safescoreReviewsRoutes = require('../../safescore-reviewer/agent/routes/reviewsRoutes');
 *     router.use('/safescore/reviews', safescoreReviewsRoutes);
 *   } catch (_) {}
 *   // [SAFESCORE-AGENT] — fin
 *
 * Rutas expuestas:
 *   GET /api/v1/safescore/reviews/user/:userId   — lista reviews + clasificación
 *
 * Auth: requiere verifyToken (cualquier usuario logueado puede consultar).
 *       El controller detecta automáticamente si el caller es el dueño
 *       del perfil y decide si incluir o no el comment.
 */

const express = require('express');
const { verifyToken } = require('../../../src/middleware/auth');
const ctl = require('../controllers/reviewsController');

const router = express.Router();

router.use(verifyToken);

router.get('/user/:userId', ctl.getUserReviews);

module.exports = router;
