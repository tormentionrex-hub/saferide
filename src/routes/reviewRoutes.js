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
router.get('/user/:userId', optionalAuth, reviewController.getReviewsByUser);

// Protected routes
router.use(verifyToken);

router.post('/', reviewValidation, validate, reviewController.createReview);
router.get('/ride/:rideId', reviewController.getReviewsByRide);
router.delete('/:id', reviewController.deleteReview);

module.exports = router;