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

// Promesas en vuelo — evita peticiones duplicadas simultáneas
let inflightDriverId = null;
let inflightVehicleStatus = null;

const sessionCache = {
    /**
     * Obtiene el ID del driver actual (usando cache si está disponible).
     * Si hay una petición en vuelo, los llamadores simultáneos esperan
     * la misma promesa en lugar de lanzar peticiones duplicadas.
     */
    getDriverId: async () => {
        if (cache.driverId) return cache.driverId;
        if (inflightDriverId) return inflightDriverId;

        inflightDriverId = api.get('/auth/me')
            .then(res => {
                if (res.data.success) {
                    cache.driverId = res.data.data._id;
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
            .then(res => {
                const hasVehicle = res.data.success && res.data.data &&
                    (Array.isArray(res.data.data) ? res.data.data.length > 0 : true);
                cache.vehicleStatus = { hasVehicle, lastCheck: Date.now() };
                return hasVehicle;
            })
            .catch(error => {
                if (error.response?.status === 404) {
                    cache.vehicleStatus = { hasVehicle: false, lastCheck: Date.now() };
                    return false;
                }
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
     * Invalida el cache del vehículo para forzar re-consulta en el próximo uso
     */
    clearVehicleStatus: () => {
        cache.vehicleStatus = null;
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
    }
};

export default sessionCache;
