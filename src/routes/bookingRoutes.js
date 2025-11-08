const express = require('express');
const { body } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const bookingValidation = [
  body('ride_id').isMongoId().withMessage('Invalid ride ID'),
  body('seats_booked').optional().isInt({ min: 1, max: 7 }).withMessage('Seats must be between 1 and 7'),
];

// All routes require authentication
router.use(verifyToken);

router.post('/', bookingValidation, validate, bookingController.createBooking);
router.get('/', bookingController.getAllBookings);
router.get('/:id', bookingController.getBookingById);
router.get('/passenger/:passengerId', bookingController.getBookingsByPassenger);
router.get('/ride/:rideId', bookingController.getBookingsByRide);
router.delete('/:id', bookingController.cancelBooking);
router.patch('/:id/status', authorize('conductor', 'administrador'), bookingController.updateBookingStatus);

module.exports = router;