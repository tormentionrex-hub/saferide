const express = require('express');
const multer = require('multer');
const userController = require('../controllers/userController');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// All routes require authentication
router.use(verifyToken);

router.get('/', authorize('administrador'), userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.post('/:id/image', upload.single('image'), userController.uploadProfileImage);
router.delete('/:id', authorize('administrador'), userController.deleteUser);
router.get('/:id/stats', userController.getUserStats);

module.exports = router;