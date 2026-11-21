import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

const AuthContext = createContext();

const ADMIN_ROLE = 'admin';

const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
};

const isAdmin = (user) => user?.type === ADMIN_ROLE;

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
            const profile = response.data?.data;

            if (!response.data?.success || !isAdmin(profile)) {
                clearSession();
                setUser(null);
                return;
            }

            setUser(profile);
        } catch (error) {
            clearSession();
            setUser(null);
            console.error('Error fetching profile:', error);
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            if (!response.data?.success) {
                return { success: false, message: response.data?.message || 'Credenciales inválidas' };
            }

            const { accessToken, refreshToken, user: loggedInUser } = response.data.data;
            if (!isAdmin(loggedInUser)) {
                clearSession();
                return { success: false, message: 'No tienes permisos de administrador' };
            }

            clearSession();
            localStorage.setItem('token', accessToken);
            if (refreshToken) {
                localStorage.setItem('refreshToken', refreshToken);
            }
            setUser(loggedInUser);
            return { success: true, user: loggedInUser };
        } catch (error) {
            clearSession();
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
            clearSession();
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
