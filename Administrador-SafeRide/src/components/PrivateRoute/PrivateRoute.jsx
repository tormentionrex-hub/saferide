import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NETWORK_MESSAGE, SERVER_MESSAGE } from '../../utils/apiErrors';
import './PrivateRoute.css';

const PrivateRoute = ({ requiredRole }) => {
    const { user, loading, connectionError, retrySession } = useAuth();

    if (loading) {
        return (
            <div id="pantallaAccesoCargando" className="contenedorCargando">
                <div id="textoAccesoCargando" className="indicadorCargando">Cargando...</div>
            </div>
        );
    }

    // Hay sesión guardada pero el servidor no respondió: no mandar al login
    // (sería un cierre de sesión falso). Se ofrece reintentar.
    if (!user && connectionError && localStorage.getItem('token')) {
        return (
            <div className="contenedorCargando" role="alert" style={{ flexDirection: 'column', gap: 12, textAlign: 'center', padding: 24 }}>
                <div className="indicadorCargando" style={{ color: '#0F172A', fontWeight: 600 }}>
                    {connectionError === 'server' ? SERVER_MESSAGE : NETWORK_MESSAGE}
                </div>
                <button type="button" onClick={retrySession} className="btnReintentarSesion"
                    style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#2563EB', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
                    Reintentar
                </button>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Verificación de rol: acepta 'admin' y 'administrador'
    if (requiredRole && user.type !== 'admin' && user.type !== 'administrador') {
        // Antes: window.location.href = '/' → '/' redirige a /inicio, que vuelve
        // a caer aquí: bucle infinito de recargas. AuthContext ya no conserva
        // sesiones que no sean de admin; esto es una segunda barrera.
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;
