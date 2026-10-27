const express = require('express');
const router = express.Router();
const { updateLocation, getDriverLocation } = require('../controllers/locationController');
const { verifyToken } = require('../middleware/auth');

router.post('/update', verifyToken, updateLocation);
router.get('/:rideId/driver', verifyToken, getDriverLocation);

module.exports = router;
