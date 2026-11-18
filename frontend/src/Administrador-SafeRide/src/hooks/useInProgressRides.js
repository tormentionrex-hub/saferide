import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import rideService from '../services/rideService';

const PREFS_KEY = 'saferide-admin-prefs';
const PREFS_EVENT = 'saferide-prefs-changed';

const readMonitoringEnabled = () => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return false;
    return JSON.parse(raw).monitoreoTiempoReal === true;
  } catch {
    return false;
  }
};

/**
 * useMonitoringEnabled — lee el toggle "monitoreoTiempoReal" de las preferencias
 * del admin y se entera de cambios:
 *  - 'storage' event: cambios en OTRAS tabs.
 *  - 'saferide-prefs-changed' custom event: cambios en la MISMA tab.
 *    (PerfilAdmin dispara este evento tras actualizar localStorage.)
 */
export const useMonitoringEnabled = () => {
  const [enabled, setEnabled] = useState(readMonitoringEnabled);

  useEffect(() => {
    const onChange = () => setEnabled(readMonitoringEnabled());
    const onStorage = (e) => { if (e.key === PREFS_KEY) onChange(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PREFS_EVENT, onChange);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PREFS_EVENT, onChange);
    };
  }, []);

  return enabled;
};

/**
 * useInProgressRides — Polling al endpoint /rides/in-progress.
 *
 * @param {object}  opts
 * @param {boolean} opts.enabled       Si false, no hace fetch ni notificaciones.
 * @param {number}  opts.intervalMs    Frecuencia de polling. Default 8 s.
 * @param {boolean} opts.notify        Si true, dispara toast por cada viaje nuevo.
 *
 * @returns {object} { rides, loading, error, refresh }
 */
export const useInProgressRides = ({ enabled = true, intervalMs = 8000, notify = true } = {}) => {
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // IDs ya vistos — para detectar viajes nuevos entre ticks.
  const seenIdsRef = useRef(new Set());
  // En la primera carga no notificamos (todos serían "nuevos" para el admin).
  const firstFetchRef = useRef(true);
  const timerRef = useRef(null);
  const cancelledRef = useRef(false);

  const fetchNow = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await rideService.getInProgressRides();
      if (cancelledRef.current) return;

      const list = Array.isArray(res?.data) ? res.data : [];
      const currentIds = new Set(list.map((r) => r._id));

      if (notify && !firstFetchRef.current) {
        list.forEach((r) => {
          if (!seenIdsRef.current.has(r._id)) {
            const driver = r.driver?.name || 'Conductor';
            const dest = r.destination?.name || 'destino';
            toast(`Nuevo viaje: ${driver} → ${dest}`, { icon: '🚗', duration: 5000 });
          }
        });
      }

      seenIdsRef.current = currentIds;
      firstFetchRef.current = false;
      setRides(list);
    } catch (err) {
      if (cancelledRef.current) return;
      console.error('[useInProgressRides] poll error:', err);
      setError(err);
    } finally {
      if (!cancelledRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    if (!enabled) {
      // Reset al apagar para que al re-encender no notifique todos los activos.
      seenIdsRef.current = new Set();
      firstFetchRef.current = true;
      setRides([]);
      return;
    }
    fetchNow();
    timerRef.current = setInterval(fetchNow, intervalMs);
    return () => {
      cancelledRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, notify]);

  return { rides, loading, error, refresh: fetchNow };
};
