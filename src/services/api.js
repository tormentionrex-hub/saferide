import axios from 'axios';
import { API_URL } from '../config.js';
import tokenStorage from './tokenStorage';
import { navigate } from './navigationRef';

// Endpoints donde un 401 NO significa "sesión expirada" sino "credenciales/código inválido".
// No deben disparar logout porque el usuario aún no tiene una sesión que cerrar.
const PUBLIC_AUTH_ENDPOINTS = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/send-verification-code',
    '/auth/verify-code',
    '/auth/reset-password',
];

const isPublicAuthRequest = (url = '') =>
    PUBLIC_AUTH_ENDPOINTS.some((endpoint) => url.includes(endpoint));

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Promesa compartida del refresh en curso. Si varias peticiones reciben 401 al
// mismo tiempo, todas esperan la misma llamada a /auth/refresh — clave porque
// el backend rota el refreshToken en cada uso y dos refresh paralelos se
// romperían entre sí.
let refreshPromise = null;

const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refreshToken = await tokenStorage.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token available');

        // axios directo (no `api`) para no pasar por este propio interceptor.
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        await tokenStorage.setTokens({ accessToken, refreshToken: newRefreshToken });
        return accessToken;
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
};

// Limpia tokens + sesión y redirige a SignIn. El caller puede pasar la config
// de la petición original; si lleva `_skipRedirect: true` se omite el navigate
// (útil para el Splash, que maneja su propia navegación tras el chequeo).
const forceLogoutAndRedirect = async (config = {}) => {
    // require dinámico para evitar el ciclo api ↔ authService en tiempo de carga.
    const { authService } = require('./authService');
    await authService.logout();
    if (!config._skipRedirect) {
        navigate('SignIn');
    }
};

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use(
    async (config) => {
        const token = await tokenStorage.getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor para manejar errores de respuesta globalmente
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalConfig = error.config;

        // Cuenta limitada por trustScore=0 (Opción A de la spec):
        // la sesión sigue siendo válida, NO se debe redirigir al login.
        if (
            error.response?.status === 403 &&
            error.response?.data?.code === 'ACCOUNT_INACTIVE'
        ) {
            return Promise.reject(error);
        }

        // 401 en endpoint público de auth (login, refresh, etc.) — no es sesión
        // expirada, es credencial/código inválido. Propagar tal cual.
        if (
            error.response?.status === 401 &&
            isPublicAuthRequest(originalConfig?.url)
        ) {
            return Promise.reject(error);
        }

        // 401 en endpoint protegido: token expirado → intentar refresh y reintentar.
        // `_skipRefresh` permite a `authService.logout()` saltarse el refresh: no
        // tiene sentido renovar una sesión que estamos cerrando.
        if (
            error.response?.status === 401 &&
            !originalConfig._retry &&
            !originalConfig._skipRefresh
        ) {
            originalConfig._retry = true;
            try {
                const newAccessToken = await refreshAccessToken();
                originalConfig.headers.Authorization = `Bearer ${newAccessToken}`;
                return api.request(originalConfig);
            } catch (refreshError) {
                // Refresh falló (refreshToken expirado, revocado, o ausente) → sesión muerta.
                await forceLogoutAndRedirect(originalConfig);
                return Promise.reject(error);
            }
        }

        // Segundo 401 sobre la misma petición tras un refresh exitoso: estado raro,
        // forzar logout para evitar bucles.
        if (error.response?.status === 401 && originalConfig._retry) {
            await forceLogoutAndRedirect(originalConfig);
        }

        return Promise.reject(error);
    }
);

export default api;
