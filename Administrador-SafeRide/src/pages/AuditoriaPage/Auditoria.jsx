import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, Search, ShieldCheck, 
  AlertTriangle, Info, Clock, Monitor, RefreshCw 
} from 'lucide-react';
import api from '../../services/api';
import { toast } from 'react-hot-toast';
import './Auditoria.css';

const Auditoria = () => {
  const [logs, setLogs] = useState([]);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL'); // ALL, CRITICAL, WARNING, INFO

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/audit-logs', { params: { limit: 200 } });
      setLogs(response.data?.data || []);
      setTotalLogs(response.data?.pagination?.total ?? response.data?.data?.length ?? 0);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('No se pudo conectar con el servidor de auditorías');
      setLogs([]);
      setTotalLogs(0);
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
      case 'COMPLAINT_CREATED': return 'Queja Registrada';
      case 'COMPLAINT_RESOLVED': return 'Queja Resuelta';
      case 'DOCUMENT_APPROVED': return 'Documento Aprobado';
      case 'DOCUMENT_REJECTED': return 'Documento Rechazado';
      case 'DOCUMENT_RESEND_REQUESTED': return 'Devolución de Documento Solicitada';
      case 'DOCUMENT_REPROCESSED': return 'Documento Reprocesado';
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
            Todos ({totalLogs})
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
          <h3>Sin datos de auditoría</h3>
          <p>No hay registros de auditoría para los filtros seleccionados.</p>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
