// Proxy de Google Directions. La app pide la ruta aquí en vez de llamar a
// Google con una clave dentro del APK, donde cualquiera puede extraerla. La
// clave del servidor (GOOGLE_MAPS_SERVER_KEY) solo necesita Directions API y
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
