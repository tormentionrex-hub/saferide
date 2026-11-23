const express = require('express');
const { body, param } = require('express-validator');
const complaintController = require('../controllers/complaintController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

router.get('/', complaintController.getComplaints);

router.post(
  '/',
  body('subject').trim().isLength({ min: 3 }).withMessage('El asunto es obligatorio'),
  body('fullMessage').trim().isLength({ min: 10 }).withMessage('El mensaje es obligatorio'),
  body('category').isIn(['Pagos', 'Conducta', 'Seguridad', 'Soporte Técnico']).withMessage('Categoría inválida'),
  body('rideId').isMongoId().withMessage('ID de viaje inválido'),
  body('bookingId').isMongoId().withMessage('ID de reserva inválido'),
  validate,
  complaintController.createComplaint
);

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
