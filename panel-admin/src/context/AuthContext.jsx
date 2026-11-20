import { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import Swal from 'sweetalert2';

const AuthContext = createContext();

// El panel es solo para administradores. Una sesión de pasajero o conductor
// no se guarda: antes quedaba el token/refreshToken y PrivateRoute recargaba
// la página en bucle (cientos de recargas por segundo).
const isAdmin = (u) => u?.type === 'admin' || u?.type === 'administrador';

const clearStoredSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
};

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

            if (response.data.success && isAdmin(response.data.data)) {
                setUser(response.data.data);
            } else {
                clearStoredSession();
                setUser(null);
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
                if (!isAdmin(user)) {
                    // Invalidar en el backend la sesión recién abierta y no guardarla.
                    await api.post('/auth/logout', {}, {
                        _skipRefresh: true,
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }).catch(() => {});
                    clearStoredSession();
                    setUser(null);
                    return { success: false, notAdmin: true, message: 'No tienes permisos de administrador.' };
                }
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

    // skipConfirm: la pantalla ya pidió confirmación. skipRemote: el token ya
    // no vale (p. ej. tras /auth/logout-all) y no tiene sentido llamar al backend.
    const cerrarSesion = async ({ skipConfirm = false, skipRemote = false } = {}) => {
        const result = skipConfirm ? { isConfirmed: true } : await Swal.fire({
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
                // {} y no null: axios envía null como el texto "null" y el backend
                // (express.json estricto) responde 400.
                if (!skipRemote) await api.post('/auth/logout', {}, { _skipRefresh: true });
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
