const express = require('express');
const monitoringController = require('../controllers/monitoringController');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

router.get('/active-rides', monitoringController.getActiveRides);

module.exports = router;
