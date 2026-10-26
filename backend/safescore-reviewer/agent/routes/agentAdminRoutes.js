/**
 * agentAdminRoutes.js — Rutas Express del agente.
 *
 * Se monta desde src/routes/index.js del backend del equipo:
 *
 *   // [SAFESCORE-AGENT]
 *   try {
 *     const agentRoutes = require('../../safescore-reviewer/agent/routes/agentAdminRoutes');
 *     router.use('/admin/agent-jobs', agentRoutes);
 *   } catch (_) {}
 *   // [SAFESCORE-AGENT] — fin
 *
 * Todos los endpoints requieren admin.
 */

const express = require('express');
const { verifyToken, authorize } = require('../../../src/middleware/auth');
const ctl = require('../controllers/agentAdminController');

const router = express.Router();

// Aplicar middleware a todas las rutas del agente
router.use(verifyToken);
router.use(authorize('admin'));

// Order matters: 'stats' antes que ':id' para que Express no interprete stats como :id
router.get('/stats',           ctl.stats);
router.get('/',                ctl.listJobs);
router.get('/:id',             ctl.getJob);
router.post('/:id/retry',      ctl.retryJob);
router.post('/enqueue',        ctl.manualEnqueue);
router.delete('/:id',          ctl.cancelJob);

module.exports = router;
