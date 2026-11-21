const express = require('express');
const { body, param } = require('express-validator');
const documentController = require('../controllers/documentController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.use(verifyToken);

router.get(
  '/driver/:driverId',
  param('driverId').isMongoId().withMessage('Invalid driver ID'),
  validate,
  documentController.getDocumentsByDriver
);

router.get('/admin/pending', authorize('admin'), documentController.getPendingDocuments);

router.patch(
  '/:id/review',
  authorize('admin'),
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('action').isIn(['approve', 'reject', 'request_resend']).withMessage('Acción inválida'),
  body('reason').optional().trim(),
  validate,
  documentController.reviewDocument
);

router.post(
  '/:id/reprocess',
  authorize('admin'),
  param('id').isMongoId().withMessage('Invalid document ID'),
  validate,
  documentController.reprocessDocument
);

module.exports = router;
