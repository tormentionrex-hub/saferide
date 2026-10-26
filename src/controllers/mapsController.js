// Proxy de Google Directions. La app pide la ruta aquí en vez de llamar a
// Google con una clave dentro del APK, donde cualquiera puede extraerla. La
// clave del servidor (GOOGLE_MAPS_SERVER_KEY) necesita Directions, Places y Geocoding y
// puede restringirse por IP.
const COORD = /^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/;
const DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';

// @desc    Ruta entre dos puntos (polilínea, distancia y duración)
// @route   GET /api/v1/maps/directions?origin=lat,lng&destination=lat,lng
// @access  Private
exports.getDirections = async (req, res, next) => {
  try {
    const { origin, destination } = req.query;
    if (!COORD.test(origin || '') || !COORD.test(destination || '')) {
      return res.status(400).json({ success: false, message: 'origin and destination must be "lat,lng"' });
    }

    const key = process.env.GOOGLE_MAPS_SERVER_KEY;
    if (!key) {
      return res.status(503).json({ success: false, message: 'Directions are not configured' });
    }

    const url = `${DIRECTIONS_URL}?origin=${origin}&destination=${destination}&key=${encodeURIComponent(key)}`;
    const response = await fetch(url);
    const data = await response.json();

    // Se devuelve la misma forma que Google, recortada a lo que usa la app,
    // para que el cliente no tenga que cambiar cómo la lee.
    const routes = (data.routes || []).slice(0, 1).map((r) => ({
      overview_polyline: { points: r.overview_polyline?.points || '' },
      legs: (r.legs || []).map((l) => ({ distance: l.distance, duration: l.duration })),
    }));

    res.status(200).json({ success: data.status === 'OK', status: data.status, routes });
  } catch (error) {
    next(error);
  }
};

// Proxy de los servicios web de Places y Geocoding. La app (autocompletado de
// direcciones y nombre del punto elegido en el mapa) los pedía directo a
// Google, y una clave restringida a la app Android/iOS no sirve para esas
// llamadas HTTP. Pasando por aquí, la única clave dentro del APK es la del
// mapa nativo. Solo se reenvían los parámetros que usa la app.
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api';
const PROXIED = {
  autocomplete: { path: '/place/autocomplete/json', params: ['input', 'language', 'components', 'sessiontoken', 'location', 'radius', 'types'] },
  details: { path: '/place/details/json', params: ['place_id', 'fields', 'language', 'sessiontoken'] },
  geocode: { path: '/geocode/json', params: ['latlng', 'language'] },
};

const proxyGoogle = (kind) => async (req, res, next) => {
  try {
    const key = process.env.GOOGLE_MAPS_SERVER_KEY;
    if (!key) {
      return res.status(503).json({ status: 'REQUEST_DENIED', error_message: 'Maps is not configured' });
    }
    const { path, params } = PROXIED[kind];
    const qs = new URLSearchParams();
    params.forEach((p) => {
      if (typeof req.query[p] === 'string' && req.query[p].length <= 300) qs.set(p, req.query[p]);
    });
    qs.set('key', key);

    const response = await fetch(`${GOOGLE_BASE}${path}?${qs.toString()}`);
    const data = await response.json();
    // Se devuelve tal cual: la librería del cliente espera el formato de Google.
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

// @route   GET /api/v1/maps/place/autocomplete/json
exports.placeAutocomplete = proxyGoogle('autocomplete');
// @route   GET /api/v1/maps/place/details/json
exports.placeDetails = proxyGoogle('details');
// @route   GET /api/v1/maps/geocode/json
exports.reverseGeocode = proxyGoogle('geocode');
