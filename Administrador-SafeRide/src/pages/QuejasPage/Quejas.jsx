/**
 * Quejas.jsx
 * 
 * Módulo de Gestión de Incidencias y Quejas — SafeRide Admin Panel
 * Este componente visualiza los reportes procesados por el agente de soporte.
 * 
 * @author SafeRide Dev Team
 */


//acabo de revisar minuciosamente los modelos del backend (User.js y Vehicle.js) 
// y confirmo que no existe ningún modelo ni campo en la base de datos para 
// almacenar múltiples documentos legales del vehículo (solo se cuenta con la 
// propiedad simple vehicleImage que guarda la foto física del auto)

//Se tendria que modificar el model o agregar otro para q guarde los papeles
//O que lleguen a un Drive o algo 


import { useState, useMemo, useEffect } from 'react';
import {
  AlertCircle, Search, Filter, Mail, User, Clock,
  ChevronRight, MessageSquare, Flag, Car, MapPin, CalendarDays, CreditCard,
  CheckCircle, Copy, RefreshCw, ChevronUp, ChevronDown
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';

import api from '../../services/api';
import './Quejas.css';

const QuejasPage = () => {
  const [quejas, setQuejas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todos');
  const [selectedQueja, setSelectedQueja] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [expandedQuejaId, setExpandedQuejaId] = useState(null);

  // Filtrado dinámico
  const filteredQuejas = useMemo(() => {
    return quejas.filter(q => {
      const term = searchTerm.toLowerCase();
      const matchSearch = (q.user || q.email || '').toLowerCase().includes(term) ||
        (q._id || q.id || '').toLowerCase().includes(term) ||
        (q.subject || '').toLowerCase().includes(term);
      const matchCategory = filterCategory === 'Todos' || q.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [quejas, searchTerm, filterCategory]);

  const handleOpenDetail = (queja) => {
    setSelectedQueja(queja);
    setReplyMessage('');
    setIsModalOpen(true);
  };

  const loadQuejas = async () => {
    setLoading(true);
    try {
      const response = await api.get('/complaints');
      setQuejas(response.data?.data || []);
    } catch (error) {
      console.error('Error cargando quejas:', error);
      setQuejas([]);
      toast.error('No se pudieron cargar las quejas del backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadQuejas(); }, []);

  const handleSendReply = async () => {
    if (!selectedQueja) return;
    setSendingReply(true);
    toast.loading('Enviando respuesta...', { id: 'reply' });

    try {
      await api.post(`/complaints/${selectedQueja._id}/reply`, { message: replyMessage });
      toast.success('Respuesta enviada', { id: 'reply' });
      setReplyMessage('');
      setIsModalOpen(false);
      loadQuejas();
    } catch (error) {
      console.error('Error enviando respuesta:', error);
      toast.error('No se pudo enviar la respuesta', { id: 'reply' });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copiado al portapapeles');
  };

  const handleResolve = (queja) => {
    Swal.fire({
      title: '¿Marcar como atendida?',
      text: 'La queja pasará a estado Atendido.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, marcar atendida',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await api.patch(`/complaints/${queja._id}/resolve`);
          toast.success('Queja marcada como atendida');
          setIsModalOpen(false);
          loadQuejas();
        } catch (error) {
          console.error('Error resolviendo queja:', error);
          toast.error('No se pudo actualizar la queja');
        }
      }
    });
  };

  return (
    <div className="quejas-container">
      <Toaster position="top-right" />

      {/* Header local con buscador */}
      <div className="quejas-header-actions">
        <div className="q-search-box">
          <Search size={18} className="q-search-icon" />
          <input
            type="text"
            placeholder="Buscar por ID, usuario o asunto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="q-filters">
          <Filter size={16} />
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="Todos">Todas las categorías</option>
            <option value="Pagos">Pagos</option>
            <option value="Conducta">Conducta</option>
            <option value="Seguridad">Seguridad</option>
            <option value="Soporte Técnico">Soporte Técnico</option>
          </select>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h1>Atención de Quejas</h1>
          <p>Monitorea y resuelve los reportes enviados por los usuarios vía email</p>
        </div>
      </div>

      <div className="q-header-actions">
        <div className="q-stats-summary">
          <div className="q-stat-item">
            <span className="q-stat-val">{quejas.length}</span>
            <span className="q-stat-lab">Registros</span>
          </div>
        </div>
        <button className="q-sync-btn" onClick={loadQuejas} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Listado de Quejas en formato Cards Premium */}
      <div className="q-cards-grid animate-fade-in">
        {filteredQuejas.length > 0 ? (
          filteredQuejas.map((q) => {
            const quejaId = q._id || q.id;
            const isExpanded = expandedQuejaId === quejaId;
            return (
              <div
                key={quejaId}
                className={`n-card ${q.status === 'Pendiente' ? 'unread' : 'read'} correo`}
              >
                {/* Banda dorada decorativa de correo */}
                <div className="n-stripe" />

                <div className="n-card-body">
                  {/* Ícono de Correo */}
                  <div className="n-icon-wrapper">
                    <Mail size={20} />
                  </div>

                  <div className="n-card-content">
                    {/* Header de la tarjeta */}
                    <div className="n-card-header-row">
                      <span className="n-id-badge">
                        {quejaId}
                      </span>
                      <span className={`n-status-tag ${q.status === 'Pendiente' ? 'pendiente' : 'atendido'}`}>
                        {q.status}
                      </span>
                    </div>

                    <p className="n-message">
                      Nueva Queja de {q.user || q.email || 'Usuario'}
                    </p>

                    {/* Preview box */}
                    <div className="n-preview-container">
                      <div className="n-preview-box">
                        <strong>Asunto: {q.subject}</strong>
                        <p>
                          {isExpanded
                            ? (q.fullMessage || q.message || '')
                            : `${(q.fullMessage || q.message || '').substring(0, 160)}...`}
                        </p>
                      </div>
                      <button
                        className="n-toggle-preview-btn"
                        onClick={() => setExpandedQuejaId(prev => prev === quejaId ? null : quejaId)}
                      >
                        {isExpanded ? (
                          <>Ocultar detalles <ChevronUp size={12} /></>
                        ) : (
                          <>Ver preview de queja completo <ChevronDown size={12} /></>
                        )}
                      </button>
                    </div>

                    {/* Meta info */}
                    <div className="n-meta">
                      <span className="n-time">
                        <Clock size={12} />
                        {new Date(q.createdAt).toLocaleDateString()} a las {new Date(q.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="n-badge-category correo">
                        {q.category}
                      </span>
                      {(q.ride_id || q.tripOrigin) && (
                        <span className="n-trip-line">
                          <Car size={12} />
                          {q.ride_id?.origin?.name || q.tripOrigin} → {q.ride_id?.destination?.name || q.tripDestination}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones de la Tarjeta */}
                  <div className="n-card-actions">
                    {q.status === 'Pendiente' && (
                      <button
                        className="n-action-btn check"
                        title="Marcar como atendida"
                        onClick={() => handleResolve(q)}
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                    <button
                      className="n-action-btn view"
                      title="Ver Detalles Completos y Responder"
                      onClick={() => handleOpenDetail(q)}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="n-empty-state">
            <MessageSquare size={56} style={{ color: '#64748B', marginBottom: '16px' }} />
            <h3>No hay quejas</h3>
            <p>No se encontraron reportes que coincidan con los filtros seleccionados.</p>
          </div>
        )}
      </div>

      {/* Modal de Detalle */}
      {isModalOpen && selectedQueja && (
        <div className="q-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="q-modal" onClick={e => e.stopPropagation()}>
            <div className="q-modal-header">
              <div className="q-modal-title-row">
                <AlertCircle size={20} color="#EF4444" />
                  <h2>Detalle de Incidencia {selectedQueja._id || selectedQueja.id}</h2>
              </div>
              <button className="q-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <div className="q-modal-content">
              <div className="q-modal-grid">
                {/* Columna Izquierda: Info de Usuario */}
                <div className="q-modal-section">
                  <h3 className="q-section-title">Información del Usuario</h3>
                  <div className="q-info-card">
                    <div className="q-info-item">
                      <User size={16} />
                      <span>{selectedQueja.user}</span>
                    </div>
                    <div className="q-info-item">
                      <Mail size={16} />
                      <span>{selectedQueja.email}</span>
                    </div>
                  </div>

                  <h3 className="q-section-title" style={{ marginTop: '20px' }}>Detalles del Viaje</h3>
                  <div className="q-info-card">
                    <div className="q-info-item" style={{ justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Flag size={16} />
                        <span>ID Viaje: {selectedQueja.tripId}</span>
                      </div>
                      {selectedQueja.tripId !== 'N/A' && (
                        <button className="q-copy-btn" onClick={() => handleCopyId(selectedQueja.tripId)}>
                          <Copy size={14} />
                        </button>
                      )}
                    </div>
                    {(selectedQueja.ride_id || selectedQueja.tripOrigin) && (
                      <>
                        <div className="q-info-item">
                          <MapPin size={16} />
                          <span>
                            {selectedQueja.ride_id?.origin?.name || selectedQueja.tripOrigin} →{' '}
                            {selectedQueja.ride_id?.destination?.name || selectedQueja.tripDestination}
                          </span>
                        </div>
                        <div className="q-info-item">
                          <CalendarDays size={16} />
                          <span>{selectedQueja.tripDate || `${selectedQueja.ride_id?.fecha || ''} ${selectedQueja.ride_id?.hora || ''}`.trim()}</span>
                        </div>
                        <div className="q-info-item">
                          <Car size={16} />
                          <span>Conductor: {selectedQueja.driver_id?.name || 'No disponible'}</span>
                        </div>
                        <div className="q-info-item">
                          <CreditCard size={16} />
                          <span>
                            Monto: ₡{selectedQueja.tripPrice ?? selectedQueja.booking_id?.charged_amount ?? selectedQueja.ride_id?.suggested_price ?? 0}
                            {selectedQueja.booking_id?.payment_status ? ` (${selectedQueja.booking_id.payment_status})` : ''}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Columna Derecha: Contenido del Mensaje */}
                <div className="q-modal-section">
                  <div className="q-message-header">
                    <h3 className="q-section-title">Asunto: {selectedQueja.subject}</h3>
                  </div>

                  <div className="q-message-box-wrapper">
                    <div className="q-message-box">
                      <MessageSquare size={16} className="q-quote-icon" />
                      <div className="q-full-text">
                        {selectedQueja.fullMessage ? (
                          selectedQueja.fullMessage.split('\n').map((line, i) => (
                            <p key={i} style={{ marginBottom: '8px' }}>{line}</p>
                          ))
                        ) : (
                          <p>{selectedQueja.message}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="q-reply-section" style={{ marginTop: '24px' }}>
                    <h3 className="q-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Mail size={16} /> Responder a Usuario
                    </h3>
                    <textarea
                      className="q-reply-textarea"
                      placeholder="Escribe la respuesta oficial que se enviará por correo..."
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      style={{
                        width: '100%',
                        height: '100px',
                        padding: '12px',
                        borderRadius: '8px',
                        border: '2px solid #F1F5F9',
                        fontSize: '0.9rem',
                        resize: 'none',
                        marginTop: '8px',
                        background: '#F8FAFC',
                        color: '#0F172A',
                        fontFamily: 'inherit',
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#2563EB';
                        e.target.style.background = 'white';
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#F1F5F9';
                        e.target.style.background = '#F8FAFC';
                      }}
                    />
                    <button
                      className="q-send-reply-btn"
                      onClick={handleSendReply}
                      disabled={sendingReply || !replyMessage.trim()}
                      style={{
                        marginTop: '12px',
                        background: '#2563EB',
                        color: 'white',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        fontWeight: '700',
                        fontSize: '0.9rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(37, 99, 235, 0.2)',
                        opacity: sendingReply || !replyMessage.trim() ? 0.6 : 1
                      }}
                    >
                      {sendingReply ? 'Enviando...' : 'Enviar Correo y Resolver'}
                    </button>
                  </div>

                  <div className="q-modal-badges" style={{ marginTop: '20px' }}>
                    <span className="q-cat-tag">{selectedQueja.category}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="q-modal-footer">
              <button className="q-btn-secondary" onClick={() => setIsModalOpen(false)}>Cerrar</button>
              <button className="q-btn-primary" onClick={() => handleResolve(selectedQueja)}>
                <CheckCircle size={18} /> Marcar como Atendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuejasPage;
