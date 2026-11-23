const express = require('express');
const { body, param, query } = require('express-validator');
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

router.get(
  '/admin/pending',
  authorize('admin'),
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  validate,
  documentController.getPendingDocuments
);

router.patch(
  '/:id/review',
  authorize('admin'),
  param('id').isMongoId().withMessage('Invalid document ID'),
  body('action').isString().isIn(['approve', 'reject', 'request_resend']).withMessage('Acción inválida'),
  body('reason').optional({ nullable: true }).isString().trim().isLength({ max: 300 })
    .not().matches(/[\u0000-\u001F\u007F]/).withMessage('Motivo inválido (máx. 300 caracteres)'),
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
