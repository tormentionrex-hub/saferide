import api from './api';
import { devLog } from '../utils/devLog';

/**
 * notificationService.js
 *
 * Wrapper REST de las notificaciones en BD (campana del Dashboard).
 * Backend: /api/v1/notifications (GET, PATCH /:id/read, PATCH /read-all, DELETE /:id).
 *
 * Opt-in de push del SO: /api/v1/auth/notification-preferences.
 *
 * NO confundir con `pushNotificationService.js` — ese registra el Expo token
 * después del login. Este maneja el centro de notificaciones in-app.
 */

const notificationService = {
    /**
     * Devuelve las notificaciones más recientes del usuario autenticado.
     * El backend ya hace sort por fecha descendente.
     *
     * @param {number} limit - Cuántas traer (default 10 para la campana).
     * @returns {Promise<{ data: Array, unreadCount: number }>}
     */
    getRecent: async (limit = 10) => {
        try {
            const res = await api.get(`/notifications?limit=${limit}`);
            if (res.data?.success) {
                return {
                    data: res.data.data || [],
                    unreadCount: res.data.unreadCount || 0,
                };
            }
        } catch (err) {
            devLog('[notificationService] getRecent error:', err?.message);
        }
        return { data: [], unreadCount: 0 };
    },

    /**
     * Marca una notificación específica como leída.
     */
    markAsRead: async (id) => {
        try {
            await api.patch(`/notifications/${id}/read`);
            return true;
        } catch (err) {
            devLog('[notificationService] markAsRead error:', err?.message);
            return false;
        }
    },

    /**
     * Marca todas las notificaciones del usuario como leídas.
     */
    markAllAsRead: async () => {
        try {
            await api.patch('/notifications/read-all');
            return true;
        } catch (err) {
            devLog('[notificationService] markAllAsRead error:', err?.message);
            return false;
        }
    },

    /**
     * Cambia la preferencia global de push del SO.
     * - true  → el backend manda push del SO cuando crea una notificación
     * - false → solo guarda en la campana, no push del SO
     *
     * El expoPushToken NO se borra al desactivar: queda guardado para que
     * reactivar no obligue a pedir permisos del SO de nuevo.
     */
    setOptIn: async (optIn) => {
        try {
            const res = await api.patch('/auth/notification-preferences', { optIn });
            return res.data?.success === true;
        } catch (err) {
            devLog('[notificationService] setOptIn error:', err?.message);
            return false;
        }
    },
};

export default notificationService;
