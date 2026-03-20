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
     * Update profile picture
     * @param {string} imageUri - Local URI of the image
     * @returns {Promise<Object>} API response data
     */
    updateProfilePicture: async (imageUri) => {
        try {
            const formData = new FormData();
            const filename = imageUri.split('/').pop();
            const match = /\.(\w+)$/.exec(filename);
            const type = match ? `image/${match[1]}` : `image`;

            formData.append('photo', {
                uri: imageUri,
                name: filename,
                type: type,
            });

            const response = await api.put('/users/profile/photo', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            return response.data;
        } catch (error) {
            throw error;
        }
    },

    /**
     * Delete user account
     * @returns {Promise<Object>} API response data
     */
    deleteAccount: async () => {
        try {
            const response = await api.delete('/users/profile');
            return response.data;
        } catch (error) {
            throw error;
        }
    }
};
