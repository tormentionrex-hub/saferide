const express = require('express');
const auditController = require('../controllers/auditController');
const { verifyToken, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, authorize('admin'));

router.get('/', auditController.getAuditLogs);

module.exports = router;
