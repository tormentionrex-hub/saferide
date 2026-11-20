import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  ShieldAlert, Search, ShieldCheck, 
  AlertTriangle, Info, Clock, Monitor, RefreshCw 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../../services/api';
import { getInitials } from '../../utils/initials';
import './Auditoria.css';

// Etiquetas y gravedad de las acciones que registra el backend
// (backend/src/models/AuditLog.js → AUDIT_ACTIONS).
const ACTION_LABELS = {
  USER_ACTIVATED: 'Usuario activado',
  USER_DEACTIVATED: 'Usuario desactivado',
  USER_TRUST_CHANGED: 'Puntaje de confianza cambiado',
  USER_HARD_DELETED: 'Usuario eliminado definitivamente',
  VEHICLE_APPROVED: 'Vehículo aprobado',
  VEHICLE_REJECTED: 'Vehículo rechazado',
  DOCUMENT_APPROVED: 'Documento aprobado',
  DOCUMENT_REJECTED: 'Documento rechazado',
  DOCUMENT_RESEND_REQUESTED: 'Reenvío de documento solicitado',
};
const ACTION_SEVERITY = {
  USER_HARD_DELETED: 'CRITICAL',
  USER_DEACTIVATED: 'WARNING',
  USER_TRUST_CHANGED: 'WARNING',
  VEHICLE_REJECTED: 'WARNING',
  DOCUMENT_REJECTED: 'WARNING',
};
const TARGET_LABELS = { User: 'Usuario', Vehicle: 'Vehículo', VehicleDocument: 'Documento' };
const PAGE_SIZE = 50;

const Auditoria = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL'); // ALL, CRITICAL, WARNING, INFO

  // Cargar registros desde la API (o Fallback)
  const fetchLogs = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await api.get('/audit-logs', { params: { page: nextPage, limit: PAGE_SIZE } });
      const data = Array.isArray(response.data?.data) ? response.data.data : [];
      setLogs(prev => (nextPage === 1 ? data : [...prev, ...data]));
      setPage(response.data?.pagination?.page || nextPage);
      setPages(response.data?.pagination?.pages || 1);
      setTotal(response.data?.pagination?.total ?? data.length);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      // Sin datos de ejemplo: si falla se dice, no se inventan registros.
      const status = error?.response?.status;
      const msg = status === 403 ? 'No tienes permiso para ver la auditoría.'
        : 'No se pudo cargar la auditoría. Revisa la conexión con el servidor.';
      setLoadError(msg);
      toast.error(msg);
      if (nextPage === 1) setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Clasifica la gravedad del log en base al tipo de acción
  const getActionSeverity = (action) => ACTION_SEVERITY[action] || 'INFO';

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
  const getActionLabel = (action) => ACTION_LABELS[action] || action;

  // Filtrar y buscar registros en memoria
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const severity = getActionSeverity(log.action);
      const matchesSeverity = severityFilter === 'ALL' || severity === severityFilter;

      const query = search.toLowerCase();
      const matchesSearch = [log.adminEmail, log.details, log.action, getActionLabel(log.action), log.ipAddress]
        .some(v => String(v || '').toLowerCase().includes(query));

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
          onClick={() => fetchLogs(1)} 
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
            Todos ({total})
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
      {loadError && !loading && logs.length === 0 ? (
        <div className="audit-empty-state" role="alert">
          <ShieldAlert size={48} className="empty-shield-icon" />
          <h3>No se pudo cargar la auditoría</h3>
          <p>{loadError}</p>
        </div>
      ) : loading && logs.length === 0 ? (
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
                          {getInitials(log.adminEmail, 1)}
                        </span>
                        <span className="admin-email-text">{log.adminEmail || '(admin eliminado)'}</span>
                      </div>
                      <div className="admin-ip-badge">
                        <span>IP: {log.ipAddress || '—'}</span>
                      </div>
                    </div>

                    {/* Fila central: Acción e ID */}
                    <div className="audit-action-row">
                      <span className={`audit-badge-action badge-${severity.toLowerCase()}`}>
                        {getActionLabel(log.action)}
                      </span>
                      <span className="audit-target-label">
                        Módulo: <strong>{TARGET_LABELS[log.targetType] || log.targetType}</strong>
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
                        <Monitor size={12} /> {log.userAgent || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {page < pages && (
            <button type="button" className="refresh-audit-btn" style={{ margin: '16px auto', display: 'flex' }}
              disabled={loading} onClick={() => fetchLogs(page + 1)}>
              {loading ? 'Cargando…' : `Cargar más (${logs.length} de ${total})`}
            </button>
          )}
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
