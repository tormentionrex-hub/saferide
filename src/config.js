import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 8080;
const API_PATH = '/api/v1';

// Sin EXPO_PUBLIC_API_URL, en desarrollo se usa la misma máquina que sirve el
// bundle de Expo (hostUri = "192.168.x.x:8081"), así un teléfono físico en la
// misma red llega al backend sin editar la IP a mano. En un build de tienda no
// hay hostUri: ahí la URL tiene que venir del perfil de eas.json.
const resolveApiUrl = () => {
    const fromEnv = process.env.EXPO_PUBLIC_API_URL;
    if (fromEnv) return fromEnv.replace(/\/+$/, '');

    if (Platform.OS === 'web') return `http://localhost:${API_PORT}${API_PATH}`;

    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri ? hostUri.split(':')[0] : null;
    if (host) return `http://${host}:${API_PORT}${API_PATH}`;

    console.warn('[config] EXPO_PUBLIC_API_URL no está definida y no se pudo deducir el host del backend.');
    return `http://localhost:${API_PORT}${API_PATH}`;
};

export const API_URL = resolveApiUrl();

export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
    console.warn('[config] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY está vacía: rutas, autocompletado y geocodificación no funcionarán.');
}

export default {
    API_URL,
    GOOGLE_MAPS_API_KEY,
};
