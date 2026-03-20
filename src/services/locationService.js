import axios from 'axios';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_API_KEY } from '../config';

/**
 * Obtiene la ubicación GPS actual del dispositivo.
 * Solicita permisos si es necesario.
 */
export const getCurrentLocation = async () => {
    try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permiso de ubicación denegado. Habilítalo en la configuración.');
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });

        return {
            lat: location.coords.latitude,
            lng: location.coords.longitude,
        };
    } catch (error) {
        console.error('Error en getCurrentLocation:', error);
        throw error;
    }
};

/**
 * Convierte coordenadas (lat, lng) en una dirección legible (Geocodificación Inversa).
 * Retorna { name, address } o null en caso de error.
 */
export const reverseGeocode = async (lat, lng) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}&language=es`
        );

        if (response.data.status === 'OK' && response.data.results.length > 0) {
            const result = response.data.results[0];
            const name = result.address_components[0].long_name;
            return {
                name: name || 'Ubicación seleccionada',
                address: result.formatted_address,
            };
        }
        return { name: 'Desconocido', address: 'Dirección no encontrada' };
    } catch (error) {
        console.error('Error en reverseGeocode:', error);
        throw error;
    }
};

/**
 * Calcula la distancia y el tiempo estimado entre dos puntos usando Directions API.
 * Retorna { distance_km, duration_minutes } o null en caso de error.
 */
export const getRouteDetails = async (origin, destination) => {
    try {
        const response = await axios.get(
            `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&key=${GOOGLE_MAPS_API_KEY}`
        );

        if (response.data.status === 'OK') {
            const route = response.data.routes[0].legs[0];
            return {
                distance_km: parseFloat((route.distance.value / 1000).toFixed(1)),
                duration_minutes: Math.ceil(route.duration.value / 60),
            };
        }
        throw new Error('No se pudo encontrar una ruta viable entre estos puntos.');
    } catch (error) {
        console.error('Error en getRouteDetails:', error);
        throw error;
    }
};
