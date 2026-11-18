import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchUserProfile();
        } else {
            setLoading(false);
        }
    }, []);

    const fetchUserProfile = async () => {
        try {
            const response = await api.get('/auth/me');

            if (response.data.success) {
                setUser(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            if (response.data.success) {
                const { accessToken, refreshToken, user } = response.data.data;
                localStorage.setItem('token', accessToken);
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }
                setUser(user);
                return { success: true, user: user };
            }
        } catch (error) {
            return {
                success: false,
                message: error.response?.data?.message || 'Error al iniciar sesión'
            };
        }
    };

    const cerrarSesion = async () => {
        const result = await Swal.fire({
            title: 'Estas por cerrar sesión',
            text: '¿Estas seguro de que quieres cerrar sesión?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#8183bdff',
            cancelButtonColor: '#2563EB',
            cancelButtonText: 'Cancelar',
            confirmButtonText: 'Sí, salir',
            background: '#ffffff',
            backdrop: `rgba(15, 23, 42, 0.4)`
        });

        if (result.isConfirmed) {
            // Mejor esfuerzo: invalidar el refresh token en el backend.
            // _skipRefresh evita que un access token expirado dispare refresh inútil
            // justo antes de invalidar la sesión.
            try {
                await api.post('/auth/logout', null, { _skipRefresh: true });
            } catch {
                /* el logout local procede aunque el backend falle */
            }
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setUser(null);
            window.location.href = '/login';
        }
    };

    return (
        <AuthContext.Provider value={{ user, setUser, login, cerrarSesion, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
