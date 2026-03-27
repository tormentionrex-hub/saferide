import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * sessionCache.js
 * Centraliza datos de usuario y viajes para evitar el error 429
 * causado por peticiones repetitivas desde múltiples componentes.
 */

const STORAGE_KEY_DRIVER_ID = '@saferide_driverId';
const STORAGE_KEY_VEHICLE_STATUS = '@saferide_vehicleStatus';

let cache = {
    driverId: null,
    vehicleStatus: null, // { hasVehicle: boolean, lastCheck: timestamp }
    activeRides: null,   // { data: array, lastCheck: timestamp }
};

// Promesas en vuelo — evita peticiones duplicadas simultáneas
let inflightDriverId = null;
let inflightVehicleStatus = null;

const sessionCache = {
    /**
     * Obtiene el ID del driver actual.
     * Orden de prioridad: memoria → AsyncStorage → API.
     * El driverId nunca cambia en una sesión, así que se persiste
     * en AsyncStorage para sobrevivir reinicios del bundle y evitar
     * llamadas repetidas a /auth/me que causan el error 429.
     */
    getDriverId: async () => {
        // 1. Memoria (más rápido)
        if (cache.driverId) return cache.driverId;

        // 2. Si ya hay una petición en vuelo, reutilizarla
        if (inflightDriverId) return inflightDriverId;

        // 3. AsyncStorage (evita llamada al API si ya lo tenemos persistido)
        try {
            const stored = await AsyncStorage.getItem(STORAGE_KEY_DRIVER_ID);
            if (stored) {
                cache.driverId = stored;
                return stored;
            }
        } catch (_) {}

        // 4. API como último recurso
        inflightDriverId = api.get('/auth/me')
            .then(async res => {
                if (res.data.success) {
                    cache.driverId = res.data.data._id;
                    try {
                        await AsyncStorage.setItem(STORAGE_KEY_DRIVER_ID, cache.driverId);
                    } catch (_) {}
                    return cache.driverId;
                }
                return null;
            })
            .catch(error => {
                console.error('[SessionCache] Error getting driverId:', error.message);
                return null;
            })
            .finally(() => {
                inflightDriverId = null;
            });

        return inflightDriverId;
    },

    /**
     * Verifica si el conductor tiene vehículo (cache de 5 min).
     * Deduplica peticiones simultáneas igual que getDriverId.
     */
    getVehicleStatus: async (force = false) => {
        const now = Date.now();
        const driverId = await sessionCache.getDriverId();
        if (!driverId) return false;

        if (!force && cache.vehicleStatus && (now - cache.vehicleStatus.lastCheck < 300000)) {
            return cache.vehicleStatus.hasVehicle;
        }

        if (inflightVehicleStatus) return inflightVehicleStatus;

        inflightVehicleStatus = api.get(`/vehicles/driver/${driverId}`)
            .then(async res => {
                const hasVehicle = res.data.success && res.data.data &&
                    (Array.isArray(res.data.data) ? res.data.data.length > 0 : true);
                cache.vehicleStatus = { hasVehicle, lastCheck: Date.now() };
                try {
                    await AsyncStorage.setItem(STORAGE_KEY_VEHICLE_STATUS, JSON.stringify(hasVehicle));
                } catch (_) {}
                return hasVehicle;
            })
            .catch(async error => {
                if (error.response?.status === 404) {
                    cache.vehicleStatus = { hasVehicle: false, lastCheck: Date.now() };
                    try {
                        await AsyncStorage.setItem(STORAGE_KEY_VEHICLE_STATUS, JSON.stringify(false));
                    } catch (_) {}
                    return false;
                }
                // Fallback: leer del AsyncStorage persistido
                try {
                    const stored = await AsyncStorage.getItem(STORAGE_KEY_VEHICLE_STATUS);
                    if (stored !== null) return JSON.parse(stored);
                } catch (_) {}
                return cache.vehicleStatus?.hasVehicle || false;
            })
            .finally(() => {
                inflightVehicleStatus = null;
            });

        return inflightVehicleStatus;
    },

    /**
     * Obtiene los viajes activos del conductor (cache de 20 seg)
     */
    getActiveRides: async (force = false) => {
        const now = Date.now();
        const driverId = await sessionCache.getDriverId();
        if (!driverId) return [];

        if (!force && cache.activeRides && (now - cache.activeRides.lastCheck < 40000)) {
            return cache.activeRides.data;
        }

        try {
            const res = await api.get(`/rides/driver/${driverId}`);
            if (res.data.success) {
                const data = res.data.data || [];
                cache.activeRides = { data, lastCheck: now };
                return data;
            }
        } catch (error) {
            console.error('[SessionCache] Error fetching rides:', error.message);
            return cache.activeRides?.data || [];
        }
        return [];
    },

    /**
     * Limpia el cache de viajes (ej. después de una acción mutativa)
     */
    clearActiveRides: () => {
        cache.activeRides = null;
    },

    /**
     * Invalida el cache del vehículo para forzar re-consulta en el próximo uso.
     * También elimina el valor persistido en AsyncStorage para que el Dashboard
     * no cargue el "false" stale al regresar después de registrar un vehículo.
     */
    clearVehicleStatus: () => {
        cache.vehicleStatus = null;
        AsyncStorage.removeItem(STORAGE_KEY_VEHICLE_STATUS).catch(() => {});
    },

    /**
     * Limpia el cache (por ejemplo al cerrar sesión)
     */
    clear: () => {
        cache = {
            driverId: null,
            vehicleStatus: null,
            activeRides: null,
        };
        inflightDriverId = null;
        inflightVehicleStatus = null;
        AsyncStorage.removeItem(STORAGE_KEY_DRIVER_ID).catch(() => {});
        AsyncStorage.removeItem(STORAGE_KEY_VEHICLE_STATUS).catch(() => {});
    }
};

export default sessionCache;
