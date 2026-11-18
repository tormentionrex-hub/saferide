import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, Search, Calendar, ShieldCheck, 
  AlertTriangle, Info, Clock, Monitor, RefreshCw 
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import './Auditoria.css';

// Registro de eventos reales simulados (Fallback para cuando el backend esté desactivado)
const FALLBACK_LOGS = [
  {
    _id: '1',
    adminEmail: 'admin@saferide.com',
    action: 'VEHICLE_APPROVED',
    targetType: 'Vehicle',
    details: 'Aprobó el vehículo BYD Yuan Plus (Placa: BJZ-829). Documentos INS y Dekra validados.',
    ipAddress: '192.168.1.15',
    userAgent: 'macOS · Chrome',
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString() // Hace 15 minutos
  },
  {
    _id: '2',
    adminEmail: 'soporte@saferide.com',
    action: 'COMPLAINT_RESOLVED',
    targetType: 'Review',
    details: 'Resolvió queja formal CMP-8253-24 y envió correo de disculpas al pasajero.',
    ipAddress: '192.168.1.42',
    userAgent: 'macOS · Safari',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() // Hace 2 horas
  },
  {
    _id: '3',
    adminEmail: 'admin@saferide.com',
    action: 'LOGIN_FAILED',
    targetType: 'Auth',
    details: 'Intento fallido de inicio de sesión. Contraseña errónea ingresada.',
    ipAddress: '201.191.24.11',
    userAgent: 'Windows · Edge',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() // Hace 4 horas
  },
  {
    _id: '4',
    adminEmail: 'admin@saferide.com',
    action: 'DRIVER_APPROVED',
    targetType: 'User',
    details: 'Aprobó y activó la cuenta del conductor Keylor Barrantes. Licencia B1 vigente.',
    ipAddress: '192.168.1.15',
    userAgent: 'macOS · Chrome',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // Hace 1 día
  },
  {
    _id: '5',
    adminEmail: 'admin@saferide.com',
    action: 'TRIP_CANCELLED_MANUALLY',
    targetType: 'Ride',
    details: 'Canceló manualmente viaje activo #9822 debido a avería mecánica reportada por el chofer.',
    ipAddress: '192.168.1.15',
    userAgent: 'macOS · Chrome',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString() // Hace 2 días
  }
];

const Auditoria = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL'); // ALL, CRITICAL, WARNING, INFO

  // Cargar registros desde la API (o Fallback)
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      /* 
        ========================================================================
        CONEXIÓN AL BACKEND (DESCOMENTAR CUANDO EL BACKEND ESTÉ LISTO):
        ========================================================================
        const response = await api.get('/audit-logs');
        if (response.data && response.data.success) {
          setLogs(response.data.data);
        } else {
          setLogs(FALLBACK_LOGS);
        }
      */
      
      // Simulación de retraso de red de 400ms para mantener transiciones fluidas
      await new Promise(resolve => setTimeout(resolve, 400));
      setLogs(FALLBACK_LOGS);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('No se pudo conectar con el servidor de auditorías');
      setLogs(FALLBACK_LOGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Clasifica la gravedad del log en base al tipo de acción
  const getActionSeverity = (action) => {
    switch (action) {
      case 'LOGIN_FAILED':
      case 'TRIP_CANCELLED_MANUALLY':
        return 'CRITICAL'; // Rojo
      case 'DRIVER_REJECTED':
      case 'VEHICLE_REJECTED':
        return 'WARNING'; // Amarillo
      default:
        return 'INFO'; // Azul / Verde
    }
  };

  // Helper para renderizar los iconos descriptivos de severidad
  const renderSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return <ShieldAlert size={16} className="log-icon-critico" />;
      case 'WARNING':
        return <AlertTriangle size={16} className="log-icon-advertencia" />;
      default:
        return <Info size={16} className="log-icon-info" />;
    }
  };

  // Helper para traducir la etiqueta técnica de la acción a algo amigable
  const getActionLabel = (action) => {
    switch (action) {
      case 'LOGIN_SUCCESS': return 'Inicio Sesión Exitoso';
      case 'LOGIN_FAILED': return 'Acceso Fallido';
      case 'DRIVER_APPROVED': return 'Conductor Aprobado';
      case 'DRIVER_REJECTED': return 'Conductor Rechazado';
      case 'VEHICLE_APPROVED': return 'Auto Aprobado';
      case 'VEHICLE_REJECTED': return 'Auto Rechazado';
      case 'COMPLAINT_RESOLVED': return 'Queja Resuelta';
      case 'TRIP_CANCELLED_MANUALLY': return 'Viaje Cancelado Manual';
      default: return action;
    }
  };

  // Filtrar y buscar registros en memoria
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const severity = getActionSeverity(log.action);
      const matchesSeverity = severityFilter === 'ALL' || severity === severityFilter;

      const query = search.toLowerCase();
      const matchesSearch = 
        log.adminEmail.toLowerCase().includes(query) ||
        log.details.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.ipAddress.includes(query);

      return matchesSeverity && matchesSearch;
    });
  }, [logs, search, severityFilter]);

  // Helper para formatear fechas amigables
  const formatFriendlyDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('es-CR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="auditoria-container">
      {/* Encabezado */}
      <header className="auditoria-header">
        <div>
          <h1>Auditoría del Sistema</h1>
          <p className="auditoria-subtitle">Historial inalterable de acciones administrativas de SafeRide</p>
        </div>
        <button 
          className="refresh-audit-btn" 
          onClick={fetchLogs} 
          disabled={loading}
          title="Actualizar bitácora"
        >
          <RefreshCw size={16} className={loading ? 'spin-animation' : ''} />
          <span>Actualizar</span>
        </button>
      </header>

      {/* Controles de Búsqueda y Filtro */}
      <section className="auditoria-controls-card">
        <div className="search-box-audit">
          <Search size={18} className="search-icon-audit" />
          <input 
            type="text" 
            placeholder="Buscar por correo, detalle, IP o acción..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="severity-filters-list">
          <button 
            className={`filter-btn-audit all ${severityFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('ALL')}
          >
            Todos ({logs.length})
          </button>
          <button 
            className={`filter-btn-audit info ${severityFilter === 'INFO' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('INFO')}
          >
            🔵 Informativos
          </button>
          <button 
            className={`filter-btn-audit warning ${severityFilter === 'WARNING' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('WARNING')}
          >
            🟡 Advertencias
          </button>
          <button 
            className={`filter-btn-audit critical ${severityFilter === 'CRITICAL' ? 'active' : ''}`}
            onClick={() => setSeverityFilter('CRITICAL')}
          >
            🔴 Críticos
          </button>
        </div>
      </section>

      {/* Listado / Línea de tiempo de Logs */}
      {loading ? (
        <div className="audit-loading-wrapper">
          <div className="audit-spinner" />
          <p>Conectando con la bóveda de auditorías...</p>
        </div>
      ) : filteredLogs.length > 0 ? (
        <div className="audit-timeline-container">
          <div className="timeline-spine" />
          
          <div className="audit-list">
            {filteredLogs.map((log) => {
              const severity = getActionSeverity(log.action);
              
              return (
                <div key={log._id} className={`audit-card-item card-${severity.toLowerCase()}`}>
                  {/* Conector gráfico a la espina de tiempo */}
                  <div className={`timeline-indicator-node node-${severity.toLowerCase()}`}>
                    {renderSeverityIcon(severity)}
                  </div>

                  <div className="audit-card-body">
                    {/* Fila superior: Admin e IP */}
                    <div className="audit-card-meta-top">
                      <div className="admin-email-tag">
                        <span className="admin-avatar-mini">
                          {log.adminEmail.charAt(0).toUpperCase()}
                        </span>
                        <span className="admin-email-text">{log.adminEmail}</span>
                      </div>
                      <div className="admin-ip-badge">
                        <span>IP: {log.ipAddress}</span>
                      </div>
                    </div>

                    {/* Fila central: Acción e ID */}
                    <div className="audit-action-row">
                      <span className={`audit-badge-action badge-${severity.toLowerCase()}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="audit-target-label">
                        Módulo: <strong>{log.targetType}</strong>
                      </span>
                    </div>

                    {/* Fila central 2: Descripción amigable */}
                    <p className="audit-details-text">{log.details}</p>

                    {/* Fila inferior: Tiempos y Dispositivo */}
                    <div className="audit-card-footer">
                      <span className="audit-time-stamp">
                        <Clock size={12} /> {formatFriendlyDate(log.createdAt)}
                      </span>
                      <span className="audit-device-stamp">
                        <Monitor size={12} /> {log.userAgent}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="audit-empty-state">
          <ShieldCheck size={48} className="empty-shield-icon" />
          <h3>No se encontraron registros</h3>
          <p>Ninguna acción de administrador coincide con los filtros o parámetros de búsqueda actuales.</p>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
