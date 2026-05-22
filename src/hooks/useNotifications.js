import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import notificationService from '../services/notificationService';

/**
 * useNotifications(active)
 *
 * Hook del centro de notificaciones (campana del Dashboard).
 *
 * - Hace polling de GET /notifications?limit=10 mientras la app está activa.
 * - Pausa en background y refresca inmediatamente al volver al foreground
 *   (mismo patrón de la Fase 1 de fluidez — no satura el backend).
 * - Anti-solapamiento: nunca hay dos requests en vuelo.
 *
 * @param {boolean} active - Si false, no inicia el polling. Útil para
 *   desactivar el hook cuando el componente padre no está montado.
 * @returns {{
 *   notifications: Array,
 *   unreadCount: number,
 *   loading: boolean,
 *   refresh: () => Promise<void>,
 *   markAsRead: (id: string) => Promise<void>,
 *   markAllAsRead: () => Promise<void>,
 * }}
 */
const POLL_MS = 30000; // 30 s — alineado con la conservación de batería de Fase 1
const LIMIT = 10;

export const useNotifications = (active = true) => {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(true);

    const intervalRef = useRef(null);
    const fetchingRef = useRef(false);
    const mountedRef = useRef(true);

    const fetchNotifications = useCallback(async () => {
        if (fetchingRef.current) return;
        fetchingRef.current = true;
        try {
            const { data, unreadCount: uc } = await notificationService.getRecent(LIMIT);
            if (!mountedRef.current) return;
            setNotifications(data);
            setUnreadCount(uc);
        } finally {
            fetchingRef.current = false;
            if (mountedRef.current) setLoading(false);
        }
    }, []);

    const markAsRead = useCallback(async (id) => {
        // Optimistic update — el badge baja inmediatamente y el siguiente
        // refresh confirma con el backend.
        setNotifications((prev) =>
            prev.map((n) => (n._id === id ? { ...n, status: 'read' } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
        await notificationService.markAsRead(id);
    }, []);

    const markAllAsRead = useCallback(async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, status: 'read' })));
        setUnreadCount(0);
        await notificationService.markAllAsRead();
    }, []);

    useEffect(() => {
        mountedRef.current = true;
        return () => { mountedRef.current = false; };
    }, []);

    useEffect(() => {
        if (!active) return undefined;

        const startPolling = () => {
            if (intervalRef.current) return;
            intervalRef.current = setInterval(fetchNotifications, POLL_MS);
        };

        const stopPolling = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };

        fetchNotifications();
        startPolling();

        const appStateSub = AppState.addEventListener('change', (next) => {
            if (next === 'active') {
                fetchNotifications();
                startPolling();
            } else {
                stopPolling();
            }
        });

        return () => {
            stopPolling();
            appStateSub.remove();
            fetchingRef.current = false;
        };
    }, [active, fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        refresh: fetchNotifications,
        markAsRead,
        markAllAsRead,
    };
};

export default useNotifications;
