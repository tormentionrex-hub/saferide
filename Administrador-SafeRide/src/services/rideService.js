import api from './api';

const rideService = {
  /**
   * Obtiene todos los viajes realizados por un conductor específico
   * @param {string} driverId - ID del conductor
   * @returns {Promise} - Lista de viajes
   */
  getRidesByDriver: async (driverId) => {
    try {
      const response = await api.get(`/rides/driver/${driverId}`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener viajes del conductor ${driverId}:`, error);
      throw error;
    }
  },

  getBookingsByPassenger: async (passengerId) => {
    try {
      const response = await api.get(`/bookings/passenger/${passengerId}`);
      return response.data;
    } catch (error) {
      console.error(`Error al obtener viajes del pasajero ${passengerId}:`, error);
      throw error;
    }
  },

  /**
   * Viajes en curso (admin). El backend filtra con GET /rides?status=in_progress.
   */
  getInProgressRides: async () => {
    const response = await api.get('/rides', { params: { status: 'in_progress' } });
    return response.data;
  },
};

export default rideService;
