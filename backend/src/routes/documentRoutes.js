const express = require('express');
const { body, param, query } = require('express-validator');
const documentController = require('../controllers/documentController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Revisión de documentos de conductores (panel de admin). Todo requiere
// sesión; revisar y listar pendientes es solo admin. Ver documentController.
router.use(verifyToken);

const idParam = [param('id').isMongoId().withMessage('Invalid ID')];

router.get('/admin/pending', authorize('admin'), [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
], validate, documentController.getPendingDocuments);

// El propio conductor también puede ver los suyos (el controlador lo comprueba).
router.get('/driver/:id', idParam, validate, documentController.getDocumentsByDriver);

router.patch('/:id/review', authorize('admin'), idParam, [
  body('action').isString().isIn(['approve', 'reject', 'request_resend']).withMessage('Invalid action'),
  // El motivo lo ve el conductor: obligatorio al rechazar o pedir reenvío,
  // texto libre con tope y sin caracteres de control.
  body('reason').if(body('action').isIn(['reject', 'request_resend']))
    .isString().trim().isLength({ min: 3, max: 300 }).withMessage('Reason is required (3-300 characters)')
    .not().matches(/[\u0000-\u001F\u007F]/).withMessage('Reason has invalid characters'),
  body('reason').optional({ nullable: true }).isString().isLength({ max: 300 }),
], validate, documentController.reviewDocument);

router.post('/:id/reprocess', authorize('admin'), idParam, validate, documentController.reprocessDocument);

module.exports = router;
