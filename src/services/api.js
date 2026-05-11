import axios from 'axios';
import { API_URL } from '../config.js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigate } from './navigationRef';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar el token a las peticiones
api.interceptors.request.use(
    async (config) => {
        const token = await AsyncStorage.getItem('userToken');
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
        if (error.response?.status === 401) {
            // Token expirado o inválido — limpiar sesión y redirigir al login
            await AsyncStorage.multiRemove(['userToken', 'userRole', 'userName']);
            navigate('SignIn');
        }
        return Promise.reject(error);
    }
);

export default api;
