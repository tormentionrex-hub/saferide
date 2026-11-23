/**
 * passengerService.js
 *
 * Capa de servicio para la gestión de Pasajeros.
 * Usa la instancia de Axios centralizada (api.js) que ya
 * incluye el interceptor de token JWT automático.
 *
 * Endpoints mapeados del backend SafeRide:
 *   GET    /users?type=pasajero     → getAllPassengers()
 *   GET    /users/:id               → getPassengerById()
 *   GET    /users/:id/stats         → getPassengerStats()
 *   PUT    /users/:id               → updatePassenger()
 *   DELETE /users/:id               → deletePassenger()
 *   POST   /users/:id/image         → uploadImage()
 *
 * @author SafeRide Dev Team
 */

import api from './api';

let _passengersCache = { data: [], pagination: null, stats: null };

const passengerService = {

  /**
   * Obtiene la caché actual.
   */
  getCachedPassengers: () => _passengersCache,

  /**
   * Obtiene todos los pasajeros (type='pasajero') con filtros y paginación.
   * @param {Object} params - { page, limit, search, company }
   * @returns {Promise<{ success: boolean, data: User[], pagination: object }>}
   */
  getAllPassengers: async (params = {}) => {
    const response = await api.get('/users', {
      params: {
        ...params,
        type: 'pasajero', // Filtro fijo al rol pasajero
      },
    });
    _passengersCache = { 
      data: response.data.data, 
      pagination: response.data.pagination,
      stats: response.data.stats 
    };
    return response.data;
  },

  /**
   * Obtiene un pasajero específico por su ID.
   * @param {string} id - MongoDB ObjectId del pasajero
   */
  getPassengerById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  /**
   * Obtiene las estadísticas de un pasajero:
   * viajes realizados, rating promedio, kilómetros, carbono.
   * @param {string} id - MongoDB ObjectId
   */
  getPassengerStats: async (id) => {
    const response = await api.get(`/users/${id}/stats`);
    return response.data;
  },

  /**
   * Actualiza información editable del pasajero.
   * Campos permitidos por backend: name, phone, company, work_schedule, profileImage
   * @param {string} id
   * @param {Object} data - Campos a actualizar
   */
  updatePassenger: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  /**
   * Desactiva (soft delete) un pasajero. Pone isActive = false.
   * Requiere rol admin.
   * @param {string} id
   */
  deletePassenger: async (id) => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  /**
   * Reactiva un pasajero. Pone isActive = true.
   * @param {string} id
   */
  activatePassenger: async (id) => {
    const response = await api.patch(`/users/${id}/activate`);
    return response.data;
  },

  /**
   * Actualiza el trustScore del pasajero. Solo admins.
   * @param {string} id
   * @param {'increment'|'reset'} action - 'increment' suma +1 (cap 4); 'reset' lo pone en 4.
   * @returns {Promise<{ success, message, data, trust: { previousScore, newScore, changed } }>}
   */
  updateTrust: async (id, action) => {
    const response = await api.patch(`/users/${id}/trust`, { action });
    return response.data;
  },

  /**
   * Elimina PERMANENTEMENTE un pasajero del sistema (hard delete).
   * Esta operación no se puede deshacer. Solo admins.
   * @param {string} id
   */
  hardDeletePassenger: async (id) => {
    const response = await api.delete(`/users/${id}/hard`);
    return response.data;
  },

  /**
   * Sube imagen de perfil del pasajero a Azure Blob Storage.
   * @param {string} id
   * @param {File} imageFile - Archivo de imagen (jpeg/png, max 5MB)
   */
  uploadImage: async (id, imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const response = await api.post(`/users/${id}/image`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};

export default passengerService;
