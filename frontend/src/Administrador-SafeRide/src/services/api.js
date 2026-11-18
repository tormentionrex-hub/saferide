import axios from 'axios';

// ─────────────────────────────────────────────────────────────────────────────
// Configuración
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

// Endpoints donde un 401 NO significa "sesión expirada" sino "credenciales inválidas".
// No deben disparar refresh ni logout porque el usuario aún no tiene una sesión que cerrar.
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
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': 'web-admin',
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Refresh token
// ─────────────────────────────────────────────────────────────────────────────
// Promesa compartida del refresh en curso. Si varias peticiones reciben 401 al
// mismo tiempo, todas esperan la misma llamada a /auth/refresh — clave porque
// el backend rota el refreshToken en cada uso y dos refresh paralelos se
// romperían entre sí.
let refreshPromise = null;

const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token available');

        // axios directo (no `api`) para no pasar por este propio interceptor.
        // Replicamos X-Client-Type a mano para mantener consistencia con el resto de peticiones.
        const response = await axios.post(
            `${BASE_URL}/auth/refresh`,
            { refreshToken },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Type': 'web-admin',
                },
            }
        );
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;
        localStorage.setItem('token', accessToken);
        if (newRefreshToken) {
            localStorage.setItem('refreshToken', newRefreshToken);
        }
        return accessToken;
    })().finally(() => {
        refreshPromise = null;
    });

    return refreshPromise;
};

const forceLogoutAndRedirect = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    // Hard redirect para garantizar limpiar estado de React.
    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Interceptors
// ─────────────────────────────────────────────────────────────────────────────

// Interceptor de request: agrega el accessToken (si existe).
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de response: maneja 401 con refresh + retry.
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalConfig = error.config;

        // 401 en endpoint público (login, refresh, etc.) — credencial/código inválido.
        // Propagar tal cual, NO intentar refresh.
        if (
            error.response?.status === 401 &&
            isPublicAuthRequest(originalConfig?.url)
        ) {
            return Promise.reject(error);
        }

        // 401 en endpoint protegido: token expirado → intentar refresh y reintentar.
        // `_skipRefresh` permite al logout saltarse el refresh.
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
                // Refresh falló (sin refresh token, revocado o expirado) → sesión muerta.
                forceLogoutAndRedirect();
                return Promise.reject(error);
            }
        }

        // Segundo 401 tras un refresh exitoso → estado raro, forzar logout para no entrar en bucle.
        if (error.response?.status === 401 && originalConfig._retry) {
            forceLogoutAndRedirect();
        }

        return Promise.reject(error);
    }
);

export default api;
