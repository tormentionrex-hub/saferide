import api from './api';

/**
 * Service to handle user profile related API calls.
 */
export const userService = {
    /**
     * Get user profile
     * @returns {Promise<Object>} API response data
     */
    getProfile: async () => {
        try {
            const response = await api.get('/users/profile');
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Update user profile
     * @param {Object} profileData - Profile details (name, phone, etc.)
     * @returns {Promise<Object>} API response data
     */
    updateProfile: async (profileData) => {
        try {
            // Si hay una imagen, convertimos a FormData si fuera necesario, 
            // pero para texto simple usamos JSON.
            const response = await api.put('/users/profile', profileData);
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Elimina la cuenta del usuario autenticado (DELETE /users/me).
     * @param {string} password - Contraseña actual, para confirmar
     */
    deleteMyAccount: async (password) => {
        const response = await api.delete('/users/me', { data: { password } });
        return response.data;
    }
};
