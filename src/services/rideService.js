import api from './api';

/**
 * Service to handle ride related API calls.
 */
export const rideService = {
    /**
     * Get rides for a specific driver
     * @param {string} driverId - The ID of the driver
     * @param {string} status - Optional status filter (completed, cancelled, etc.)
     * @returns {Promise<Object>} API response data
     */
    getRidesByDriver: async (driverId, status) => {
        try {
            const response = await api.get(`/rides/driver/${driverId}${status ? `?status=${status}` : ''}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get bookings for a specific ride
     * @param {string} rideId - The ID of the ride
     * @returns {Promise<Object>} API response data
     */
    getBookingsByRide: async (rideId) => {
        try {
            const response = await api.get(`/bookings/ride/${rideId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Get bookings for a specific passenger (history)
     * @param {string} passengerId - The ID of the passenger
     * @returns {Promise<Object>} API response data
     */
    getBookingsByPassenger: async (passengerId) => {
        try {
            const response = await api.get(`/bookings/passenger/${passengerId}`);
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};
