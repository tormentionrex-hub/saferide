const express = require('express');
const { createOrder, captureOrder } = require('../controllers/paypalController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/create-order', verifyToken, createOrder);
router.post('/capture-order', verifyToken, captureOrder);

module.exports = router;
