const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Validation rules
const notificationValidation = [
  body('user_id').isMongoId().withMessage('Invalid user ID'),
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('type').isIn(['booking_confirmed', 'booking_cancelled', 'ride_reminder', 'ride_completed', 'review_request', 'system']),
];

// All routes require authentication
router.use(verifyToken);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.post('/', authorize('administrador'), notificationValidation, validate, notificationController.createNotification);

module.exports = router;