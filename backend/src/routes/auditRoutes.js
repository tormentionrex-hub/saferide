const express = require('express');
const { query } = require('express-validator');
const auditController = require('../controllers/auditController');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');
const { AUDIT_ACTIONS } = require('../models/AuditLog');

const router = express.Router();

// Solo admin; filtros con tipo y valores cerrados (nada llega a la consulta
// sin validar).
router.get('/', verifyToken, authorize('admin'), [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('action').optional().isString().isIn(AUDIT_ACTIONS),
  query('targetType').optional().isString().isIn(['User', 'Vehicle', 'VehicleDocument']),
  query('adminId').optional().isString().isMongoId(),
  query('from').optional().isString().isISO8601(),
  query('to').optional().isString().isISO8601(),
], validate, auditController.getAuditLogs);

module.exports = router;
