const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const vehicleRoutes = require('./vehicleRoutes');
const rideRoutes = require('./rideRoutes');
const bookingRoutes = require('./bookingRoutes');
const notificationRoutes = require('./notificationRoutes');
const reviewRoutes = require('./reviewRoutes');
const metricsRoutes = require('./metricsRoutes');
const locationRoutes = require('./locationRoutes');
const paypalRoutes = require('./paypalRoutes');

const router = express.Router();

if (process.env.NODE_ENV === 'development') {
  const { runJobManually } = require('../jobs');

  router.post('/jobs/run/:jobName', async (req, res) => {
    try {
      const result = await runJobManually(req.params.jobName);
      res.json({
        success: true,
        result
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  })
}

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Safe-Ride API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/vehicles', vehicleRoutes);
router.use('/rides', rideRoutes);
router.use('/bookings', bookingRoutes);
router.use('/notifications', notificationRoutes);
router.use('/reviews', reviewRoutes);
router.use('/metrics', metricsRoutes);
router.use('/location', locationRoutes);
router.use('/paypal', paypalRoutes);

// [SAFESCORE-AGENT] — Endpoints admin del agente (visibilidad de jobs y stats)
try {
  const agentAdminRoutes = require('../../safescore-reviewer/agent/routes/agentAdminRoutes');
  router.use('/admin/agent-jobs', agentAdminRoutes);
} catch (_) { /* agente no disponible, sigue el resto */ }
// [SAFESCORE-AGENT] — fin

// [SAFESCORE-AGENT] — Endpoints públicos de reviews con clasificación IA (para el móvil)
try {
  const safescoreReviewsRoutes = require('../../safescore-reviewer/agent/routes/reviewsRoutes');
  router.use('/safescore/reviews', safescoreReviewsRoutes);
} catch (_) { /* agente no disponible, sigue el resto */ }
// [SAFESCORE-AGENT] — fin

module.exports = router;