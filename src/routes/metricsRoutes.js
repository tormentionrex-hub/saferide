const express = require('express');
const metricsController = require('../controllers/metricsController');
const { verifyToken, authorize, optionalAuth } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/leaderboard', optionalAuth, metricsController.getLeaderboard);

// Protected routes
router.use(verifyToken);

router.get('/user/:userId', metricsController.getUserMetrics);
router.post('/calculate/:userId', authorize('administrador'), metricsController.calculateMetrics);
router.get('/global', authorize('administrador'), metricsController.getGlobalMetrics);

module.exports = router;