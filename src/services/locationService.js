import * as Location from 'expo-location';
import api from './api';

/**
 * Obtiene la ubicación GPS actual del dispositivo con alta precisión.
 */
export const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
        throw new Error('Permiso de ubicación denegado. Habilítalo en la configuración.');
    }

    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    return {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
    };
};

/**
 * Convierte coordenadas exactas en un nombre y dirección legible para mostrar.
 * Las coordenadas pasadas NO se modifican — solo se obtiene el texto descriptivo.
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        // Pasa por el proxy del backend: la clave de Google queda en el servidor.
        const response = await api.get('/maps/geocode/json', {
            params: { latlng: `${lat},${lng}`, language: 'es' },
        });

        if (response.data.status !== 'OK' || !response.data.results.length) {
            return { name: 'Ubicación seleccionada', address: '' };
        }

        // Usar el primer resultado (el más preciso que retorna Google)
        const best = response.data.results[0];
        const fullAddress = best.formatted_address || '';

        // El nombre es la primera parte de la dirección antes del primer coma
        // Ej: "Calle 5, San José, Costa Rica" → "Calle 5"
        const name = fullAddress.split(',')[0].trim() || 'Ubicación seleccionada';

        return { name, address: fullAddress };
    } catch (error) {
        console.error('[reverseGeocode] Error:', error.message);
        return { name: 'Ubicación seleccionada', address: '' };
    }
};

/**
 * Calcula distancia y tiempo estimado entre dos puntos usando Directions API.
 */
export const getRouteDetails = async (origin, destination) => {
    try {
        const data = await fetchDirections(origin.lat, origin.lng, destination.lat, destination.lng);

        if (data.status === 'OK' && data.routes?.length) {
            const leg = data.routes[0].legs[0];
            return {
                distance_km: parseFloat((leg.distance.value / 1000).toFixed(1)),
                duration_minutes: Math.ceil(leg.duration.value / 60),
            };
        }

        throw new Error('No se pudo encontrar una ruta viable entre estos puntos.');
    } catch (error) {
        console.error('[getRouteDetails] Error:', error.message);
        throw error;
    }
};

/**
 * Ruta entre dos puntos calculada por el backend (GET /maps/directions), que
 * guarda la clave de Google en el servidor. Devuelve la misma forma que
 * Google Directions: { status, routes: [{ overview_polyline, legs }] }.
 */
export const fetchDirections = async (originLat, originLng, destLat, destLng) => {
    const { data } = await api.get('/maps/directions', {
        params: { origin: `${originLat},${originLng}`, destination: `${destLat},${destLng}` },
    });
    return data;
};
