const express = require('express');
const { body } = require('express-validator');
const rideController = require('../controllers/rideController');
const { verifyToken, authorize, optionalAuth } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const rideValidation = [
  body('origin.name').trim().notEmpty().withMessage('Origin name is required'),
  body('origin.coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('origin.coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('destination.name').trim().notEmpty().withMessage('Destination name is required'),
  body('destination.coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('destination.coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('date_time').isISO8601().withMessage('Invalid date format'),
  body('available_seats').isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
  body('distance_km').optional().isFloat({ min: 0 }),
  body('duration_minutes').optional().isInt({ min: 0 }),
];

// Public routes (with optional auth)
router.get('/', optionalAuth, rideController.getAllRides);
router.get('/:id', optionalAuth, rideController.getRideById);

// Protected routes
router.use(verifyToken);

router.post('/', authorize('conductor'), rideValidation, validate, rideController.createRide);
router.put('/:id', authorize('conductor'), rideController.updateRide);
router.delete('/:id', authorize('conductor'), rideController.cancelRide);
router.get('/driver/:driverId', rideController.getRidesByDriver);
router.patch('/:id/start', authorize('conductor'), rideController.startRide);
router.patch('/:id/complete', authorize('conductor'), rideController.completeRide);

module.exports = router;