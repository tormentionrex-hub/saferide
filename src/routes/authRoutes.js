const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('name').trim().isLength({ min: 4 }).withMessage('Name must be at least 4 characters'),
  body('username').trim().isLength({ min: 4 }).withMessage('Username must be at least 4 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('phone').matches(/^\d{8}$/).withMessage('Phone must be 8 digits'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
  body('company').notEmpty().withMessage('Company is required'),
  body('type').optional().isIn(['conductor', 'pasajero', 'administrador']),
];

const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
];

const passwordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain uppercase, lowercase, number and special character'),
];

// Routes
router.post('/register', authLimiter, registerValidation, validate, authController.register);
router.post('/login', authLimiter, loginValidation, validate, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', verifyToken, authController.logout);
router.get('/me', verifyToken, authController.getMe);
router.put('/password', verifyToken, passwordValidation, validate, authController.updatePassword);

module.exports = router;