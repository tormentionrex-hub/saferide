import api from './api';

const notificationService = {
  /**
   * Obtiene todas las notificaciones del administrador
   */
  getNotifications: async (params = {}) => {
    try {
      const response = await api.get('/notifications', {
        params: { scope: 'all', limit: 100, ...params },
      });
      return response.data;
    } catch (error) {
      console.error('Error al obtener notificaciones:', error);
      throw error;
    }
  },

  /**
   * Marca una notificación como leída
   */
  markAsRead: async (id) => {
    try {
      const response = await api.patch(`/notifications/${id}/read`);
      return response.data;
    } catch (error) {
      console.error(`Error al marcar notificación ${id} como leída:`, error);
      throw error;
    }
  },

  /**
   * Marca todas las notificaciones como leídas
   */
  markAllAsRead: async () => {
    try {
      const response = await api.patch('/notifications/read-all', null, {
        params: { scope: 'all' },
      });
      return response.data;
    } catch (error) {
      console.error('Error al marcar todas las notificaciones como leídas:', error);
      throw error;
    }
  },

  /**
   * Elimina una notificación
   */
  deleteNotification: async (id) => {
    try {
      const response = await api.delete(`/notifications/${id}`);
      return response.data;
    } catch (error) {
      console.error(`Error al eliminar notificación ${id}:`, error);
      throw error;
    }
  },

  /**
   * Crea una nueva notificación manual (ej. alertas administrativas)
   */
  createNotification: async (data) => {
    try {
      const response = await api.post('/notifications', data);
      return response.data;
    } catch (error) {
      console.error('Error al crear notificación:', error);
      throw error;
    }
  }
};

export default notificationService;
