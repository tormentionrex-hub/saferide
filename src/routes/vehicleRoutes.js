const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const vehicleController = require('../controllers/vehicleController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Configure multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Validation rules
const vehicleValidation = [
  body('brand').trim().notEmpty().withMessage('Brand is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('license_plate').matches(/^[A-Z0-9]{6}$/).withMessage('License plate must be 6 characters'),
  body('color').trim().notEmpty().withMessage('Color is required'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 1 }),
];

// All routes require authentication
router.use(verifyToken);

router.post('/', authorize('conductor'), vehicleValidation, validate, vehicleController.createVehicle);
router.get('/driver/:driverId', vehicleController.getVehicleByDriver);
router.get('/:id', vehicleController.getVehicleById);
router.put('/:id', authorize('conductor'), vehicleController.updateVehicle);
router.post('/:id/image', authorize('conductor'), upload.single('image'), vehicleController.uploadVehicleImage);
router.delete('/:id', vehicleController.deleteVehicle);

module.exports = router;
