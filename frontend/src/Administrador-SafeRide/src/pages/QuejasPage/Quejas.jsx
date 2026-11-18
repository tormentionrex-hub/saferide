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


import { useState, useMemo } from 'react';
import {
  AlertCircle, Search, Filter, Mail, User, Clock,
  ChevronRight, MessageSquare, Tag, Flag,
  CheckCircle, AlertTriangle, Info, Copy, ExternalLink,
  ChevronLeft, ChevronsLeft, ChevronsRight, RefreshCw,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { toast, Toaster } from 'react-hot-toast';
import Swal from 'sweetalert2';

import complaintsData from '../../data/complaints.json';
import './Quejas.css';

const StatusBadge = ({ status }) => {
  const styles = {
    Pendiente: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' },
    "En Revisión": { bg: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' },
    Atendido: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }
  };
  const config = styles[status] || { bg: '#F1F5F9', color: '#64748B' };

  return (
    <div className="q-status" style={{ backgroundColor: config.bg, color: config.color }}>
      <div className="q-status-dot" style={{ backgroundColor: config.color }} />
      {status}
    </div>
  );
};

const QuejasPage = () => {
  const [quejas, setQuejas] = useState(complaintsData);
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
      const matchSearch = q.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        q.subject.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = filterCategory === 'Todos' || q.category === filterCategory;
      return matchSearch && matchCategory;
    });
  }, [searchTerm, filterCategory]);

  const handleOpenDetail = (queja) => {
    setSelectedQueja(queja);
    setReplyMessage('');
    setIsModalOpen(true);
  };

  const handleSendReply = async () => {
    if (!selectedQueja) return;
    setSendingReply(true);
    toast.loading('Enviando correo de respuesta...', { id: 'reply' });

    try {
      const response = await fetch('http://localhost:3001/api/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedQueja.email,
          subject: selectedQueja.subject,
          message: replyMessage
        })
      });

      if (response.ok) {
        toast.success('¡Respuesta enviada con éxito!', { id: 'reply' });

        // Auto-resolver
        try {
          await fetch(`http://localhost:3001/api/resolve/${selectedQueja.uid}`, {
            method: 'POST'
          });
          toast.success('Incidencia marcada como atendida');
        } catch (resolveErr) {
          console.error('Error auto-resolving:', resolveErr);
        }

        setReplyMessage('');
        setIsModalOpen(false);
        setTimeout(handleSync, 500);
      } else {
        const errData = await response.json();
        toast.error(`Error: ${errData.error || 'No se pudo enviar el correo'}`, { id: 'reply' });
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      toast.error('El Agente no está respondiendo', { id: 'reply' });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCopyId = (id) => {
    navigator.clipboard.writeText(id);
    toast.success('ID copiado al portapapeles');
  };

  // Función para forzar sincronización manual con el Agente
  const handleSync = async () => {
    toast.loading('Sincronizando con Gmail...', { id: 'sync' });
    try {
      const response = await fetch('http://localhost:3001/api/sync');
      const data = await response.json();
      setQuejas(data);
      toast.success('Sincronización completa', { id: 'sync' });
    } catch (error) {
      toast.error('Error: El Agente no está activo', { id: 'sync' });
    }
  };

  const handleResolve = (queja) => {
    Swal.fire({
      title: '¿Marcar como atendida?',
      text: `Esto marcará el correo como LEÍDO en Gmail de forma permanente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, resolver en Gmail',
      cancelButtonText: 'Cancelar'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const response = await fetch(`http://localhost:3001/api/resolve/${queja.uid}`, {
            method: 'POST'
          });

          if (response.ok) {
            toast.success('¡Hecho! Marcado como leído en Gmail');
            setIsModalOpen(false);
            // Sincronizar para actualizar la lista
            setTimeout(handleSync, 500);
          } else {
            toast.error('Error al resolver en Gmail');
          }
        } catch (error) {
          toast.error('El Agente no está respondiendo');
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

      {/* Badge de pendientes + botón de sincronizar */}
      <div className="q-header-actions">
        <div className="q-stats-summary">
          <div className="q-stat-item">
            <span className="q-stat-val">{quejas.length}</span>
            <span className="q-stat-lab">Pendientes</span>
          </div>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#E2E8F0', flexShrink: 0 }} />
        <button className="q-sync-btn" onClick={handleSync}>
          <RefreshCw size={15} />
          Sincronizar Gmail
        </button>
      </div>

      {/* Listado de Quejas en formato Cards Premium */}
      <div className="q-cards-grid animate-fade-in">
        {filteredQuejas.length > 0 ? (
          filteredQuejas.map((q) => {
            const isExpanded = expandedQuejaId === q.id;
            return (
              <div
                key={q.id}
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
                        {q.id}
                      </span>
                      <span className={`n-status-tag ${q.status === 'Pendiente' ? 'pendiente' : 'atendido'}`}>
                        {q.status}
                      </span>
                    </div>

                    <p className="n-message">
                      Nueva Queja de {q.user} ({q.email})
                    </p>

                    {/* Preview box */}
                    <div className="n-preview-container">
                      <div className="n-preview-box">
                        <strong>Asunto: {q.subject}</strong>
                        <p>
                          {isExpanded
                            ? q.fullMessage || q.message
                            : `${(q.fullMessage || q.message).substring(0, 160)}...`}
                        </p>
                      </div>
                      <button
                        className="n-toggle-preview-btn"
                        onClick={() => setExpandedQuejaId(prev => prev === q.id ? null : q.id)}
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
                <h2>Detalle de Incidencia {selectedQueja.id}</h2>
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
