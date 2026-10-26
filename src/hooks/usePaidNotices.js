import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rideService } from '../services/rideService';
import sessionCache from '../services/sessionCache';
import { devLog } from '../utils/devLog';

const STORAGE_KEY = '@saferide_paidBookingsSeen_v1';
const POLL_MS = 25000;
const LOOKBACK_DAYS = 14;

/**
 * usePaidNotices(active)
 *
 * Detecta cuando un pasajero recién pagó un viaje pendiente. Compara contra
 * un snapshot persistido en AsyncStorage para evitar mostrar el aviso varias
 * veces o disparar avisos retroactivos en la primera ejecución.
 *
 * - Primera vez del conductor con el feature: marca todos los pagos actuales
 *   como "vistos" en silencio (sin banners).
 * - Después: cualquier bookingId nuevo con payment_status='paid' que no esté
 *   en el snapshot dispara un aviso.
 *
 * Cuando el banner se descarta, el booking se mantiene como visto.
 */
export const usePaidNotices = (active = true) => {
    const [notices, setNotices] = useState([]);
    const intervalRef = useRef(null);
    const fetchingRef = useRef(false);
    const mountedRef = useRef(true);

    const fetchPaid = async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const driverId = await sessionCache.getDriverId();
            if (!driverId) return;

            const completedRes = await rideService.getRidesByDriver(driverId, 'completed');
            const rides = completedRes?.data || [];

            const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
            const recentRides = rides.filter(r => {
                if (!r?.fecha) return false;
                const dt = new Date(`${r.fecha}T${r.hora || '00:00'}`).getTime();
                return !isNaN(dt) && dt > cutoff;
            });

            const bookingsByRide = await Promise.all(
                recentRides.map(r =>
                    rideService.getBookingsByRide(r._id).catch(() => null)
                )
            );

            const allPaid = [];
            bookingsByRide.forEach(res => {
                if (!res?.data) return;
                res.data.forEach(b => {
                    if (b.payment_status === 'paid' && b.status === 'completed') {
                        allPaid.push({
                            bookingId: b._id,
                            passengerName: b.passenger_id?.name || 'Pasajero',
                            amount: Number(b.charged_amount) || 0,
                        });
                    }
                });
            });

            const stored = await AsyncStorage.getItem(STORAGE_KEY);

            if (!stored) {
                // Primera vez: snapshot silencioso (no notifica retroactivamente)
                const initSeen = {};
                allPaid.forEach(p => { initSeen[p.bookingId] = true; });
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(initSeen));
                return;
            }

            const seen = JSON.parse(stored);
            const fresh = allPaid.filter(p => !seen[p.bookingId]);
            if (fresh.length === 0) return;

            if (mountedRef.current) {
                setNotices(prev => {
                    const existing = new Set(prev.map(n => n.bookingId));
                    const additions = fresh.filter(p => !existing.has(p.bookingId));
                    return [...prev, ...additions];
                });
            }

            const updated = { ...seen };
            fresh.forEach(p => { updated[p.bookingId] = true; });
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
            devLog('[usePaidNotices] error:', e?.message);
        } finally {
            fetchingRef.current = false;
        }
    };

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!active) return;
        fetchPaid();
        intervalRef.current = setInterval(fetchPaid, POLL_MS);
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [active]);

    const dismissNotice = (bookingId) => {
        setNotices(prev => prev.filter(n => n.bookingId !== bookingId));
    };

    return { notices, dismissNotice };
};
