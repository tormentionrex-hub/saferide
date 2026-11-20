const express = require('express');
const { body } = require('express-validator');
const { getConfig, createOrder, captureOrder } = require('../controllers/paypalController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validation');

const router = express.Router();

// Primera capa contra la manipulación de la llamada a PayPal: el orderId se
// pega en la URL de la API de PayPal (con el token del comercio), así que solo
// se aceptan IDs alfanuméricos. El controlador lo vuelve a validar y además
// codifica el valor en la URL.
const bookingIdRule = body('bookingId').isString().isMongoId().withMessage('Invalid booking ID');
const orderIdRule = body('orderId').isString().matches(/^[A-Z0-9]{8,36}$/).withMessage('Invalid order ID');

router.get('/config', getConfig);
router.post('/create-order', verifyToken, [bookingIdRule], validate, createOrder);
router.post('/capture-order', verifyToken, [bookingIdRule, orderIdRule], validate, captureOrder);

module.exports = router;
