import { useState, useCallback, memo, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';

// Contextos
import { useAuth } from '../../context/AuthContext';

// Iconos e imagenes
import {
  LayoutDashboard, Users, User, UserCheck, Car,
  Bell, AlertCircle, ShieldCheck, Settings, ChevronDown, Menu, Search,
  Activity
} from 'lucide-react';
import IconSafeRide from '../../imgs/IconSafeRide.png';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';
import { Toaster } from 'react-hot-toast';

// Services
import notificationService from '../../services/notificationService';
import { useInProgressRides, useMonitoringEnabled } from '../../hooks/useInProgressRides';
import './AdminLayout.css';

const NavItem = memo(({ to, icon: Icon, label, active, onClick, badge }) => (
  <Link to={to} className={"navItem " + (active ? 'active' : '')} onClick={onClick}>
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <Icon size={20} />
      <span style={{ marginLeft: '14px', flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span className="sidebarBadge">{badge}</span>
      )}
    </div>
  </Link>
));

// ───────────────────────────────────────────────────────────────────────────────────────────────────
import complaintsData from '../../data/complaints.json';

const AdminLayout = () => {

  const { user, cerrarSesion } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [usuariosOpen, setUsuariosOpen] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Monitoreo en tiempo real (controlado por toggle en PerfilAdmin → localStorage).
  // El hook polea /rides/in-progress cada 8 s y dispara toast por cada viaje nuevo.
  const monitoringEnabled = useMonitoringEnabled();
  useInProgressRides({ enabled: monitoringEnabled, intervalMs: 8000, notify: true });

  const loadUnreadCount = useCallback(async () => {
    try {
      const res = await notificationService.getNotifications();
      const list = res?.data || [];
      const backendUnread = list.filter(n => n.status === 'unread').length;

      const readComplaints = JSON.parse(localStorage.getItem('readComplaints') || '[]');
      const complaintsUnread = (complaintsData || []).filter(q => q.status === 'Pendiente' && !readComplaints.includes(`complaint_${q.id}`)).length;

      setUnreadCount(backendUnread + complaintsUnread);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    loadUnreadCount();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount();
      }
    };

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount();
      }
    }, 10000); // Equilibrado a 10 segundos para mayor fluidez de red

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('notificationsUpdated', loadUnreadCount);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('notificationsUpdated', loadUnreadCount);
    };
  }, [loadUnreadCount]);

  const getDefaultImagen = (img) => img || DefaultImageUser;

  const handleCloseSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuAbierto(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="dashboardContent">
      <Toaster position="top-right" />

      {/* --- SIDEBAR PERSISTENTE --- */}
      <aside className={sidebarOpen ? 'open' : ''}>
        <div className="sidebaLogo">
          <img src={IconSafeRide} alt="Icono" className='IconSafeRide' />
          <span>SafeRide</span>
        </div>

        <nav className="sidebarNav">
          <NavItem
            to="/inicio"
            icon={LayoutDashboard}
            label="Panel"
            active={location.pathname === '/inicio'}
            onClick={handleCloseSidebar}
          />

          {/* SUB-MENÚ USUARIOS */}
          <div className="navGroup">

            <div
              className={`navItem ${location.pathname.includes('/usuarios') || location.pathname.includes('/conductores') ? 'active' : ''}`}
              onClick={() => {
                setUsuariosOpen(!usuariosOpen);
              }}
              style={{ cursor: 'pointer' }}
            >
              <Users size={20} />
              <span style={{ flex: 1 }}>Usuarios</span>
              <ChevronDown size={16} style={{ transform: usuariosOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
            </div>

            {usuariosOpen && (
              <div className="subPanel">

                <Link to="/usuarios" className={`subNavItem ${location.pathname === '/usuarios' ? 'active' : ''}`} onClick={handleCloseSidebar}>
                  <User size={18} /> <span>Pasajeros</span>
                </Link>

                <Link to="/conductores" className={`subNavItem ${location.pathname === '/conductores' ? 'active' : ''}`} onClick={handleCloseSidebar}>
                  <UserCheck size={18} /> <span>Conductores</span>
                </Link>
              </div>
            )}
          </div>

          <NavItem
            to="/vehiculos"
            icon={Car}
            label="Vehículos"
            active={location.pathname === '/vehiculos'}
            onClick={handleCloseSidebar}
          />

          <NavItem
            to="/monitoreo"
            icon={Activity}
            label="Monitoreo"
            active={location.pathname === '/monitoreo'}
            onClick={handleCloseSidebar}
          />

          <NavItem
            to="/notificaciones"
            icon={Bell}
            label="Notificaciones"
            active={location.pathname === '/notificaciones'}
            onClick={handleCloseSidebar}
            badge={unreadCount}
          />

          <NavItem
            to="/quejas"
            icon={AlertCircle}
            label="Quejas"
            active={location.pathname === '/quejas'}
            onClick={handleCloseSidebar}
          />

          <NavItem
            to="/auditoria"
            icon={ShieldCheck}
            label="Auditoría"
            active={location.pathname === '/auditoria'}
            onClick={handleCloseSidebar}
          />

          <NavItem
            to="/configuracion"
            icon={Settings}
            label="Configuración"
            active={location.pathname === '/configuracion'}
            onClick={handleCloseSidebar}
          />
        </nav>

        <div className="sidebarPerfil">
          <img src={getDefaultImagen(user?.profileImage)} alt="Admin" className="FotoPerfil" />
          <div className="PerfilInfo">
            <span className="NombrePerfil">{user?.name || 'Admin'}</span>
            <span className="RolPerfil">Super Administrador</span>
          </div>
        </div>
      </aside>


      {/* --- CONTENIDO PRINCIPAL --- */}
      <main>
        <header>

          <div className="headerIzquierdo">
            <div className="buscadorContainer">
              <Search size={18} className="buscadorIcono" />
              <input type="text" placeholder="Buscar en el sistema..." />
            </div>
          </div>

          <div className="headerDerecho">
            <div className="userInfo">
              <span id="header-welcome">Bienvenido/a, {user?.name || 'Admin'}</span>
            </div>

            <div className="userInfo">

              <img src={getDefaultImagen(user?.profileImage)} alt="Admin" className="FotoPerfilHeader" />
            </div>

            <Link
              to="/notificaciones"
              className="notificacionCampana"
              title="Centro de Notificaciones"
            >
              <Bell size={24} className={unreadCount > 0 ? "animacion-tintineo" : ""} />
              {unreadCount > 0 && (
                <span className="notificacionBadge">{unreadCount}</span>
              )}
            </Link>

            <div className="menuIconContainer" style={{ position: 'relative' }} ref={menuRef}>
              <Menu
                size={24}
                className="IconMenu"
                onClick={() => setMenuAbierto(!menuAbierto)}
                style={{ cursor: 'pointer' }}
              />

              {menuAbierto && (
                <div className="menuDesplegable animate-slide-down" style={{ top: '100%', right: 0, marginTop: '10px' }}>
                  <div className="menuHeader">
                    <img src={getDefaultImagen(user?.profileImage)} alt="Admin" className="menuUserAvatar" />
                    <div className="menuUserInfo">
                      <span className="menuUserName">{user?.name}</span>
                      <span className="menuUserEmail">{user?.email}</span>
                    </div>
                  </div>
                  <div className="menuDivider"></div>
                  <Link to="/miPerfil" className="menuItem" onClick={() => setMenuAbierto(false)}>
                    <Users size={18} /> <span>Mi Perfil</span>
                  </Link>
                  <Link to="/configuracion" className="menuItem" onClick={() => setMenuAbierto(false)}>
                    <Settings size={18} /> <span>Configuración</span>
                  </Link>
                  <div className="menuDivider"></div>
                  <button className="menuItem logout" onClick={() => { cerrarSesion(); setMenuAbierto(false); }}>
                    <AlertCircle size={18} /> <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="dashboardBody">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AdminLayout;
