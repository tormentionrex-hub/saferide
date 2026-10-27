const express = require('express');
const { getDirections, placeAutocomplete, placeDetails, reverseGeocode } = require('../controllers/mapsController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Con sesión: evita que el proxy se use para gastar la cuota de Google.
router.get('/directions', verifyToken, getDirections);
// Mismas rutas que arma react-native-google-places-autocomplete con requestUrl.
router.get('/place/autocomplete/json', verifyToken, placeAutocomplete);
router.get('/place/details/json', verifyToken, placeDetails);
router.get('/geocode/json', verifyToken, reverseGeocode);

module.exports = router;
