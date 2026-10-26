const express = require('express');
const { getDirections } = require('../controllers/mapsController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Con sesión: evita que el proxy se use para gastar la cuota de Google.
router.get('/directions', verifyToken, getDirections);

module.exports = router;
