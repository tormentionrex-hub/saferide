const express = require('express');
const auditController = require('../controllers/auditController');
const { query } = require('express-validator');
const { verifyToken, authorize } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

// Filtros con forma acotada: el panel pide hasta 200 registros.
const auditQueryValidation = [
  query('page').optional().isInt({ min: 1, max: 100000 }),
  query('limit').optional().isInt({ min: 1, max: 500 }),
  query('action').optional().isString().matches(/^[A-Z_]{1,40}$/),
  query('search').optional().isString().isLength({ max: 100 }),
];

router.get('/', auditQueryValidation, validate, auditController.getAuditLogs);

module.exports = router;
