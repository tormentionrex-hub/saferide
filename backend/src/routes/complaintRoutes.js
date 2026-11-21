const express = require('express');
const { body, param } = require('express-validator');
const complaintController = require('../controllers/complaintController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

router.get('/', complaintController.getComplaints);

router.post(
  '/:id/reply',
  param('id').isMongoId().withMessage('Invalid complaint ID'),
  body('message').trim().isLength({ min: 1 }).withMessage('El mensaje es obligatorio'),
  validate,
  complaintController.replyComplaint
);

router.patch(
  '/:id/resolve',
  param('id').isMongoId().withMessage('Invalid complaint ID'),
  validate,
  complaintController.resolveComplaint
);

module.exports = router;
