import api from './api';
import tokenStorage from './tokenStorage';
import sessionStorage from './sessionStorage';
import sessionCache from './sessionCache';

// Evita que un 401 disparado por la propia llamada a /auth/logout
// vuelva a invocar logout desde el interceptor de respuestas.
let isLoggingOut = false;

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
        const response = await api.post('/auth/register', userData);
        return response.data;
    },

    /**
     * Login an existing user. Persiste accessToken + refreshToken en SecureStore,
     * el perfil en AsyncStorage y limpia cualquier cache de sesión anterior.
     * @param {string} email - User email
     * @param {string} password - User password
     * @returns {Promise<Object>} API response data (incluye user, accessToken, refreshToken)
     */
    login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { user, accessToken, refreshToken } = response.data.data;
        sessionCache.clear();
        await tokenStorage.setTokens({ accessToken, refreshToken });
        await sessionStorage.setSession(user);
        return response.data;
    },

    /**
     * Cierra sesión limpiando tokens (SecureStore), datos de perfil
     * (AsyncStorage) y caches en memoria. Llama al backend para invalidar
     * el refresh token, pero si esa llamada falla igual se limpia local.
     * No navega — el caller decide a dónde ir después.
     */
    logout: async () => {
        if (isLoggingOut) return;
        isLoggingOut = true;
        try {
            // _skipRefresh: si el access token está expirado no tiene sentido
            // refrescarlo solo para invalidarlo enseguida.
            await api.post('/auth/logout', null, { _skipRefresh: true }).catch(() => {});
            await Promise.all([
                tokenStorage.clearTokens(),
                sessionStorage.clearSession(),
            ]);
            sessionCache.clear();
        } finally {
            isLoggingOut = false;
        }
    },
};
