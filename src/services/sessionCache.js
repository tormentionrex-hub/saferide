import api from './api';

/**
 * sessionCache.js
 * Centraliza datos de usuario y viajes para evitar el error 429
 * causado por peticiones repetitivas desde múltiples componentes.
 */

let cache = {
    driverId: null,
    vehicleStatus: null, // { hasVehicle: boolean, lastCheck: timestamp }
    activeRides: null,   // { data: array, lastCheck: timestamp }
};

const sessionCache = {
    /**
     * Obtiene el ID del driver actual (usando cache si está disponible)
     */
    getDriverId: async () => {
        if (cache.driverId) return cache.driverId;
        try {
            const res = await api.get('/auth/me');
            if (res.data.success) {
                cache.driverId = res.data.data._id;
                return cache.driverId;
            }
        } catch (error) {
            console.error('[SessionCache] Error getting driverId:', error.message);
        }
        return null;
    },

    /**
     * Verifica si el conductor tiene vehículo (cache de 5 min)
     */
    getVehicleStatus: async (force = false) => {
        const now = Date.now();
        const driverId = await sessionCache.getDriverId();
        if (!driverId) return false;

        if (!force && cache.vehicleStatus && (now - cache.vehicleStatus.lastCheck < 300000)) {
            return cache.vehicleStatus.hasVehicle;
        }

        try {
            const res = await api.get(`/vehicles/driver/${driverId}`);
            const hasVehicle = res.data.success && res.data.data && 
                (Array.isArray(res.data.data) ? res.data.data.length > 0 : true);
            
            cache.vehicleStatus = { hasVehicle, lastCheck: now };
            return hasVehicle;
        } catch (error) {
            if (error.response?.status === 404) {
                cache.vehicleStatus = { hasVehicle: false, lastCheck: now };
                return false;
            }
            return cache.vehicleStatus?.hasVehicle || false;
        }
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
     * Limpia el cache (por ejemplo al cerrar sesión)
     */
    clear: () => {
        cache = {
            driverId: null,
            vehicleStatus: null,
            activeRides: null,
        };
    }
};

export default sessionCache;
