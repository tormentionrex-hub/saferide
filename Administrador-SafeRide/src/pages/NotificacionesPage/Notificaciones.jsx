import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Bell, AlertTriangle, Mail, CheckCircle, Clock, Trash2, Search, Check
} from 'lucide-react';
import notificationService from '../../services/notificationService';
import { toast } from 'react-hot-toast';
import Swal from 'sweetalert2';
import './Notificaciones.css';

const Notificaciones = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'seguros', 'correos', 'sistema'
  const [searchTerm, setSearchTerm] = useState('');
  const [unreadTotal, setUnreadTotal] = useState(0);
  const seenIdsRef = useRef(new Set());

  // Cargar notificaciones reales del backend
  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      let backendList = [];
      try {
        const res = await notificationService.getNotifications();
        backendList = res?.data || [];
        setUnreadTotal(Number(res?.unreadCount) || 0);
      } catch (err) {
        console.error('Error al cargar notificaciones del backend:', err);
      }

      // Clasificación de categorías para notificaciones del backend
      const categorizedBackend = backendList.map(n => {
        let category = 'sistema';
        const msgLower = (n.message || '').toLowerCase();
        if (msgLower.includes('seguro') || msgLower.includes('rtv') || msgLower.includes('dekra') || msgLower.includes('licencia')) {
          category = 'seguro';
        } else if (msgLower.includes('correo') || msgLower.includes('queja') || msgLower.includes('mensaje') || msgLower.includes('incidencia')) {
          category = 'correo';
        }
        return { ...n, category };
      });

      const categorizedBackendSorted = [...categorizedBackend];
      categorizedBackendSorted.sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date));

      setNotifications(categorizedBackendSorted);
    } catch (error) {
      console.error('Error en orquestación de notificaciones:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Marcar como leída (silent se usa cuando se marca por estar visible)
  const handleMarkAsRead = async (id, { silent = false } = {}) => {
    try {
      await notificationService.markAsRead(id);
      const target = notifications.find(n => n._id === id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: 'read' } : n));
      if (target?.status === 'unread') setUnreadTotal(v => Math.max(0, v - 1));
      if (!silent) toast.success('Notificación marcada como leída');
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error(err);
      seenIdsRef.current.delete(id);
      if (!silent) toast.error('Error al actualizar la notificación en el servidor');
    }
  };

  // Marcar todas como leídas
  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => {
        prev.forEach(n => seenIdsRef.current.add(n._id));
        return prev.map(n => ({ ...n, status: 'read' }));
      });
      setUnreadTotal(0);
      toast.success('Todas las notificaciones marcadas como leídas');
      window.dispatchEvent(new Event('notificationsUpdated'));
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar las notificaciones');
    }
  };

  // Las notificaciones que el admin tiene a la vista se marcan solas
  useEffect(() => {
    if (loading || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const id = entry.target.getAttribute('data-id');
        if (!id || seenIdsRef.current.has(id)) return;
        seenIdsRef.current.add(id);
        handleMarkAsRead(id, { silent: true });
      });
    }, { threshold: 0.6 });

    document.querySelectorAll('.n-card.unread').forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [loading, notifications]);

  // Eliminar notificación de la lista
  const handleDeleteNotification = async (id) => {
    try {
      const result = await Swal.fire({
        title: '¿Eliminar notificación?',
        text: 'Esta acción se realizará de forma permanente en la base de datos.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#EF4444',
        cancelButtonColor: '#64748B',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        customClass: { popup: 'n-swal-popup', confirmButton: 'n-swal-confirm' }
      });

      if (result.isConfirmed) {
        await notificationService.deleteNotification(id);
        const target = notifications.find(n => n._id === id);
        setNotifications(prev => prev.filter(n => n._id !== id));
        if (target?.status === 'unread') setUnreadTotal(v => Math.max(0, v - 1));
        toast.success('Notificación eliminada');
      }
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar la notificación del servidor');
    }
  };



  // Filtrado y Búsqueda sobre datos reales
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      const matchSearch = (n.message || '').toLowerCase().includes(searchTerm.toLowerCase());
      if (activeTab === 'all') return matchSearch;
      if (activeTab === 'seguros') return matchSearch && n.category === 'seguro';
      if (activeTab === 'correos') return matchSearch && n.category === 'correo';
      if (activeTab === 'sistema') return matchSearch && n.category === 'sistema';
      return matchSearch;
    });
  }, [notifications, activeTab, searchTerm]);

  // Contadores basados estrictamente en datos reales
  const unreadCount = unreadTotal;

  // Conversor de fecha a formato amigable
  const timeAgo = (dateStr) => {
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `Hace ${diffHours} hr`;
      const diffDays = Math.floor(diffHours / 24);
      return `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
    } catch {
      return 'Recientemente';
    }
  };

  return (
    <div className="notificaciones-container">
      {/* HEADER PRINCIPAL */}
      <div className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1.75rem', fontWeight: '800', color: '#0F172A' }}>
            <Bell size={28} style={{ color: '#3B82F6' }} />
            Centro de Notificaciones
          </h1>
          <p style={{ color: '#64748B', fontSize: '0.85rem' }}>
            Alertas reales de la base de datos. Las que tengas a la vista se marcan solas o usa “Marcar leídas”.
          </p>
        </div>

        {/* ACCIONES SUPERIORES */}
        <div className="n-header-actions">
          {unreadCount > 0 && (
            <div className="n-unread-indicator">
              <span className="n-unread-num">{unreadCount}</span>
              <span className="n-unread-text">Sin leer</span>
            </div>
          )}

          <button className="n-btn n-btn-secondary" onClick={handleMarkAllAsRead} disabled={unreadCount === 0}>
            <Check size={16} /> Marcar leídas
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS & BUSCADOR */}
      <div className="notificaciones-bar">
        <div className="n-search-box">
          <Search size={18} className="n-search-icon" />
          <input
            type="text"
            placeholder="Buscar alertas por palabra clave..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* CATEGORÍA EN TABS DE DISEÑO PREMIUM */}
        <div className="n-tabs">
          <button className={`n-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>
            Todas ({notifications.length})
          </button>
          <button className={`n-tab-btn ${activeTab === 'seguros' ? 'active' : ''}`} onClick={() => setActiveTab('seguros')}>
            ⚠️ Seguros & RTV ({notifications.filter(n => n.category === 'seguro').length})
          </button>
          <button className={`n-tab-btn ${activeTab === 'correos' ? 'active' : ''}`} onClick={() => setActiveTab('correos')}>
            ✉️ Soporte & Correo ({notifications.filter(n => n.category === 'correo').length})
          </button>
          <button className={`n-tab-btn ${activeTab === 'sistema' ? 'active' : ''}`} onClick={() => setActiveTab('sistema')}>
            ⚙️ Sistema ({notifications.filter(n => n.category === 'sistema').length})
          </button>
        </div>
      </div>

      {/* GRILLA DE ALERTAS REALES */}
      {loading ? (
        <div className="n-loading-container">
          <div className="n-spinner" />
          <p>Cargando notificaciones en tiempo real...</p>
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="n-grid animate-fade-in">
          {filteredNotifications.map((notif) => {
            return (
              <div
                key={notif._id}
                data-id={notif._id}
                className={`n-card ${notif.status === 'unread' ? 'unread' : 'read'} ${notif.category}`}
              >
                {/* Indicador visual lateral */}
                <div className="n-stripe" />

                <div className="n-card-body">
                  {/* Ícono dinámico */}
                  <div className="n-icon-wrapper">
                    {notif.category === 'seguro' && <AlertTriangle size={20} className="icon-seguro" />}
                    {notif.category === 'correo' && <Mail size={20} className="icon-correo" />}
                    {notif.category === 'sistema' && <Bell size={20} className="icon-sistema" />}
                  </div>

                  <div className="n-card-content">
                    <p className="n-message">{notif.message}</p>
                    


                    <div className="n-meta" style={{ marginTop: '6px' }}>
                      <span className="n-time">
                        <Clock size={12} style={{ marginRight: '4px' }} />
                        {timeAgo(notif.createdAt || notif.date)}
                      </span>
                      <span className={`n-badge-category ${notif.category}`}>
                        {notif.category === 'seguro' ? 'Seguro / RTV' : (notif.category === 'correo' ? 'Queja Pasajero' : 'Sistema')}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de tarjeta */}
                  <div className="n-card-actions">
                    {notif.status === 'unread' && (
                      <button
                        className="n-action-btn check"
                        title="Marcar como leída"
                        onClick={() => handleMarkAsRead(notif._id)}
                      >
                        <Check size={16} />
                      </button>
                    )}
                    <button
                      className="n-action-btn delete"
                      title="Eliminar notificación"
                      onClick={() => handleDeleteNotification(notif._id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="n-empty-state">
          <CheckCircle size={56} style={{ color: '#64748B', marginBottom: '16px' }} />
          <h3>No hay notificaciones</h3>
          <p>No se encontraron registros de notificaciones en la base de datos.</p>
        </div>
      )}
    </div>
  );
};

export default Notificaciones;
