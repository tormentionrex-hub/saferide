import api from './api';

const vehicleService = {
  /**
   * Obtiene todos los vehículos del inventario (Admin)
   * @param {Object} params - { page, limit, status, search }
   */
  getAllVehicles: async (params = {}) => {
    const response = await api.get('/vehicles', { params });
    return response.data;
  },

  /**
   * Obtiene un vehículo por su ID
   */
  getVehicleById: async (id) => {
    const response = await api.get(`/vehicles/${id}`);
    return response.data;
  },

  /**
   * Aprueba o desactiva un vehículo
   * @param {string} id - ID del vehículo
   * @param {boolean} isActive - Nuevo estado
   */
  updateVehicleStatus: async (id, isActive) => {
    const response = await api.patch(`/vehicles/${id}/status`, { isActive });
    return response.data;
  },

  /**
   * Crea un nuevo vehículo (Admin)
   */
  createVehicle: async (data) => {
    const response = await api.post('/vehicles', data);
    return response.data;
  },

  /**
   * Elimina un vehículo
   */
  deleteVehicle: async (id) => {
    const response = await api.delete(`/vehicles/${id}`);
    return response.data;
  }
};

export default vehicleService;
