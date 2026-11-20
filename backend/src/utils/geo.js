// Distancia en línea recta (haversine) entre dos { lat, lng }, en km.
// Devuelve NaN si alguna coordenada falta o no es un número finito.
const straightLineKm = (a, b) => {
  const lat1 = Number(a?.lat); const lng1 = Number(a?.lng);
  const lat2 = Number(b?.lat); const lng2 = Number(b?.lng);
  if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return NaN;
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

// Origen y destino deben ser lugares distintos. La regla de la app (0,5 km)
// se mide por carretera (distance_km); en línea recta se exige solo que no
// sean el mismo punto (50 m), porque dos lugares a 0,6 km por carretera
// pueden estar a menos de 0,5 km en línea recta.
const MIN_POINT_SEPARATION_KM = 0.05;
const MIN_RIDE_KM = 0.5;

module.exports = { straightLineKm, MIN_POINT_SEPARATION_KM, MIN_RIDE_KM };
