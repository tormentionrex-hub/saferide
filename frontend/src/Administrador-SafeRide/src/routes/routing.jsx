import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PrivateRoute      from '../components/PrivateRoute/PrivateRoute';
import AdminLayout       from '../components/AdminLayout/AdminLayout';

// Carga perezosa (lazy load) de las páginas para optimizar la velocidad inicial de carga
const Login             = lazy(() => import('../pages/LoginPages/Login'));
const NuevoPassword     = lazy(() => import('../pages/LoginPages/NuevoPassword'));
const RecuperarPassword = lazy(() => import('../pages/LoginPages/RecuperarPassword'));
const Dashboard         = lazy(() => import('../pages/DashboardPage/Dashboard'));
const PerfilAdmin       = lazy(() => import('../pages/PerfilAdminPage/PerfilAdmin'));
const PasajerosPage     = lazy(() => import('../pages/PasajerosPage/Pasajeros'));
const ConductoresPage   = lazy(() => import('../pages/ConductoresPage/ConductoresPage'));
const VehiculosPage     = lazy(() => import('../pages/VehiculosPage/Vehiculos'));
const QuejasPage        = lazy(() => import('../pages/QuejasPage/Quejas'));
const NotificacionesPage = lazy(() => import('../pages/NotificacionesPage/Notificaciones'));
const Configuracion     = lazy(() => import('../pages/ConfiguracionPage/Configuracion'));
const AuditoriaPage     = lazy(() => import('../pages/AuditoriaPage/Auditoria'));
const MonitoreoPage     = lazy(() => import('../pages/MonitoreoPage/Monitoreo'));

/** Placeholder temporal para páginas aún no implementadas */
const PlaceholderPage = ({ title }) => (
  <div style={{
    padding: '40px',
    fontFamily: 'Inter, sans-serif',
    background: '#F8FAFC',
    minHeight: '100vh'
  }}>
    <h2 style={{ color: '#0F172A' }}>{title}</h2>
    <p style={{ color: '#64748B' }}>Página en construcción.</p>
  </div>
);

/** Spinner elegante de carga para la transición entre páginas lazy */
const LoadingSpinner = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    width: '100%',
    flexDirection: 'column',
    gap: '16px',
    fontFamily: 'Inter, sans-serif'
  }}>
    <div style={{
      width: '40px',
      height: '40px',
      border: '3.5px solid rgba(0, 0, 0, 0.05)',
      borderTopColor: '#3B82F6',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite'
    }} />
    <p style={{ color: '#64748B', fontSize: '13px', fontWeight: '500' }}>Cargando módulo...</p>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

const Routing = () => (
  <Router>
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        {/* ── RUTAS PÚBLICAS ────────────────────────────────── */}
        <Route path="/login"                element={<Login />} />
        <Route path="/Login"                element={<Login />} />
        <Route path="/recuperarPassword"    element={<RecuperarPassword />} />
        <Route path="/nuevoPassword"        element={<NuevoPassword />} />

        {/* ── RUTAS PRIVADAS (ADMIN ONLY) ───────────────────── */}
        <Route element={<PrivateRoute requiredRole="admin" />}>
          {/* PerfilAdmin se renderiza SIN AdminLayout (sin aside ni header) */}
          <Route path="/miPerfil" element={<PerfilAdmin />} />

          {/* El resto de las páginas SÍ usan AdminLayout */}
          <Route element={<AdminLayout />}>
            <Route path="/inicio"         element={<Dashboard />} />
            <Route path="/usuarios"       element={<PasajerosPage />} />
            <Route path="/conductores"    element={<ConductoresPage />} />
            <Route path="/vehiculos"      element={<VehiculosPage />} />
            <Route path="/monitoreo"      element={<MonitoreoPage />} />
            <Route path="/reservas"       element={<PlaceholderPage title="Gestión de Reservas" />} />
            <Route path="/pagos"          element={<PlaceholderPage title="Historial de Pagos" />} />
            <Route path="/notificaciones" element={<NotificacionesPage />} />
            <Route path="/quejas"         element={<QuejasPage />} />
            <Route path="/auditoria"      element={<AuditoriaPage />} />
            <Route path="/configuracion"  element={<Configuracion />} />
          </Route>
        </Route>

        {/* ── REDIRECCIONES ───────────────────────── */}
        <Route path="/"  element={<Navigate to="/inicio" replace />} />
        <Route path="*"  element={<Navigate to="/inicio" replace />} />
      </Routes>
    </Suspense>
  </Router>
);

export default Routing;
