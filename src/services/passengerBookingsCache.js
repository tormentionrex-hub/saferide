/**
 * passengerBookingsCache.js
 *
 * Cache compartida (en memoria) de los bookings del pasajero actual.
 * Las pantallas DashboardPasajero (rutas frecuentes), History y Metrics
 * solían pedir la misma lista por separado; con esta cache un solo fetch
 * por ventana de 60s alimenta a las tres → al cambiar de tab, las
 * pantallas se hidratan instantáneamente.
 *
 * Cada consumidor sigue filtrando localmente (cancelled vs completed,
 * pagos pendientes, rutas, etc.) — la cache guarda la lista completa.
 *
 * Invalidación: llamar a `invalidate()` después de una mutación local
 * (crear/cancelar booking, pagar) o usar `get(true)` para forzar.
 */

import sessionCache from './sessionCache';
import { rideService } from './rideService';

const TTL = 60 * 1000;
let cache = { userId: null, data: null, ts: 0 };
let inflight = null;

const passengerBookingsCache = {
    /**
     * Devuelve la lista de bookings del pasajero actual.
     * - Si hay cache fresca para el userId actual, la devuelve sin red.
     * - Si hay petición en vuelo, se engancha a la misma promesa.
     * - `force = true` salta el cache (pull-to-refresh).
     */
    get: async (force = false) => {
        const userId = await sessionCache.getPassengerId();
        if (!userId) return [];

        const now = Date.now();
        if (
            !force &&
            cache.userId === userId &&
            cache.data &&
            now - cache.ts < TTL
        ) {
            return cache.data;
        }

        if (inflight) return inflight;

        inflight = rideService
            .getBookingsByPassenger(userId)
            .then(res => {
                const list =
                    res && res.success && Array.isArray(res.data) ? res.data : [];
                cache = { userId, data: list, ts: Date.now() };
                return list;
            })
            .catch(err => {
                // No cacheamos errores: dejamos que el próximo focus reintente.
                console.error('[passengerBookingsCache] error:', err?.message);
                return [];
            })
            .finally(() => {
                inflight = null;
            });

        return inflight;
    },

    /**
     * Devuelve la última lista cacheada sin disparar fetch.
     * Útil para hidratar UI inmediatamente y luego refrescar en background.
     */
    peek: () => (cache.data ? cache.data : null),

    /**
     * Invalida la cache. Llamar tras una mutación local
     * (reservar, cancelar, pagar) para que el próximo `get` traiga datos frescos.
     */
    invalidate: () => {
        cache = { userId: null, data: null, ts: 0 };
        inflight = null;
    },
};

export default passengerBookingsCache;
