import api from './api';

/**
 * Service to handle authentication related API calls.
 */
export const authService = {
    /**
     * Register a new user
     * @param {Object} userData - User details (email, password, name, username, etc.)
     * @returns {Promise<Object>} API response data
     */
    register: async (userData) => {
        try {
            const response = await api.post('/auth/register', userData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Login an existing user
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} API response data
     */
    login: async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Logout user
     * @returns {Promise<Object>} API response data
     */
    logout: async () => {
        try {
            const response = await api.post('/auth/logout');
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};
