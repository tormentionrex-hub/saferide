import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './PrivateRoute.css';

const PrivateRoute = ({ requiredRole }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div id="pantallaAccesoCargando" className="contenedorCargando">
                <div id="textoAccesoCargando" className="indicadorCargando">Cargando...</div>
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
