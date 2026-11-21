/**
 * ConductoresPage.jsx
 * 
 * Página de Gestión de Conductores — SafeRide Admin Panel
 * Sincronizada con la estructura exacta de Pasajeros.jsx para heredar estilos.
 * 
 * @author SafeRide Dev Team
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard, Users, UserCheck, Car, Calendar, CreditCard,
  Bell, AlertCircle, ShieldCheck, Settings, Search, Menu,
  ChevronDown, Plus, Truck, Star, Zap, MapPin, Clock,
  Award, Activity, Eye, Edit, Trash2, CheckCircle, Mail, Phone,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  FileCheck
} from 'lucide-react';
import driverService from '../../services/driverService';
import documentService from '../../services/documentService';
import DriverProfileModal from '../../components/DriverProfileModal';
import Swal from 'sweetalert2';
import { toast, Toaster } from 'react-hot-toast';

import '../DashboardPage/Dashboard.css';
import './ConductoresPage.css';
import '../PasajerosPage/Pasajeros.css';
import IconSafeRide from '../../imgs/IconSafeRide.png';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';

// ─────────────────────────────────────────────────────────────
const getDefaultImagen = (url) => (url && url.trim() !== '') ? url : DefaultImageUser;

// ─────────────────────────────────────────────────────────────
// COMPONENTE: Skeleton para carga de tarjetas
// ─────────────────────────────────────────────────────────────
const CardSkeleton = () => (
  <div className="conductor-card skeleton">
    <div className="card-header skeleton-pulse">
      <div className="skeleton-img" />
      <div className="skeleton-badge" />
    </div>
    <div className="card-content">
      <div className="skeleton-line title" />
      <div className="skeleton-line subtitle" />
      <div className="vehicle-info-mini" style={{ marginTop: '12px' }}>
        <div className="skeleton-line small" />
        <div className="skeleton-line small" />
      </div>
    </div>
    <div className="card-actions">
      <div className="skeleton-btn" />
      <div className="skeleton-btn" />
      <div className="skeleton-btn" />
    </div>
  </div>
);

const DriverCard = React.memo(({ driver, onEdit, onDelete, onActivate, onView, onViewDocuments, docFlag, index }) => {
  return (
    <div className="conductor-card" style={{ '--card-index': index }}>
      <div className="card-header">
        <img
          src={getDefaultImagen(driver.profileImage)}
          alt={driver.name}
          className="conductor-img"
          loading="lazy"
        />
        <div className={`status-badge ${driver.isActive ? 'active' : 'inactive'}`}>
          {driver.isActive ? 'Activo' : 'Inactivo'}
        </div>
        {docFlag && (
          <div
            className={`doc-flag doc-flag--${docFlag}`}
            title={
              docFlag === 'rejected' ? 'Documento rechazado' :
              docFlag === 'needs_review' ? 'Documento por revisar' :
              'Documento en cola'
            }
          >
            <FileCheck size={11} />
          </div>
        )}
      </div>

      <div className="card-content">
        <h3 className="conductor-name">{driver.name}</h3>
        <p className="conductor-role">
          <Mail size={13} style={{ marginRight: '6px' }} />
          {driver.email}
        </p>

        <div className="vehicle-info-mini" style={{ marginTop: '12px' }}>
          <div className="info-item">
            <Phone size={14} />
            <span>{driver.phone || 'Sin teléfono'}</span>
          </div>
          <div className="info-item">
            <Car size={14} />
            <span>{driver.vehicle?.license_plate || 'Sin placa'}</span>
          </div>
        </div>
      </div>

      <div className="card-actions">
        {!driver.isActive ? (
          <button
            className="action-btn activate"
            title="Activar"
            onClick={() => onActivate(driver)}
            style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)' }}
          >
            <CheckCircle size={18} />
          </button>
        ) : (
          <button className="action-btn view" title="Ver Historial de Viajes" onClick={() => onView(driver)}>
            <Eye size={18} />
          </button>
        )}
        <button
          className={`action-btn documents ${docFlag ? `has-flag has-flag--${docFlag}` : ''}`}
          title="Revisar Documentos"
          onClick={() => onViewDocuments(driver)}
        >
          <FileCheck size={18} />
        </button>
        <button className="action-btn edit" title="Editar" onClick={() => onEdit(driver)}>
          <Edit size={18} />
        </button>
        {driver.isActive && (
          <button className="action-btn delete" title="Desactivar" onClick={() => onDelete(driver)}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL: ConductoresPage
// ─────────────────────────────────────────────────────────────
const ConductoresPage = () => {
  const { user, logout, cerrarSesion } = useAuth();
  const location = useLocation();

  const cached = driverService.getCachedDrivers();
  const [drivers, setDrivers] = useState(cached.data || []);
  const [loading, setLoading] = useState(!cached.data?.length);
  const [searchTerm, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('info');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const lastRequestId = useRef(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cached.pagination?.pages || 1);
  const [stats, setStats] = useState({
    total: cached.pagination?.total || 0,
    activeNow: cached.stats?.active || 0,
    avgRating: cached.stats?.rating || 0,
    onTrip: 0,
  });
  const [selectedLetter, setSelectedLetter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = más nuevos primero, 'asc' = más viejos primero
  const [docFlagsByDriver, setDocFlagsByDriver] = useState({}); // driverId -> 'rejected' | 'needs_review' | 'pending'
  const [showOnlyWithDocIssues, setShowOnlyWithDocIssues] = useState(false);


  const loadDrivers = useCallback(async () => {
    const requestId = ++lastRequestId.current;
    setLoading(true);
    try {
      const response = await driverService.getAllDrivers({
        search: searchTerm,
        initial: selectedLetter,
        page: currentPage,
        limit: 9,
        sort: sortOrder
      });


      console.log(response);
      

      const list = response?.data;
      const pagination = response?.pagination;

      if (pagination) {
        setTotalPages(pagination.pages || 1);
      }

      if (requestId !== lastRequestId.current) return;

      if (Array.isArray(list)) {
        // Optimización: Solo enriquecemos si no hay muchos conductores o de forma secuencial controlada
        // Para evitar lag, limitamos las peticiones concurrentes
        // Enriquecer con vehículos en paralelo para mayor velocidad
        const enriched = await Promise.all(
          list.map(async (d) => {
            try {
              const vehicle = await driverService.getVehicleByDriver(d._id);
              return { ...d, vehicle };
            } catch (vErr) {
              return { ...d, vehicle: null };
            }
          })
        );

        if (requestId !== lastRequestId.current) return;

        console.log('[ConductoresPage] Drivers loaded:', enriched);
        setDrivers(enriched);

        setStats({
          total: response.stats?.total || response.pagination?.total || 0,
          activeNow: response.stats?.active || 0,
          avgRating: (enriched.reduce((s, d) => s + (d.rating || 0), 0) / (enriched.length || 1)).toFixed(1),
          onTrip: 0,
        });
      } else {
        setDrivers([]);
        setStats({ total: 0, activeNow: 0, avgRating: 0, onTrip: 0 });
      }
    } catch (err) {
      console.error('[ConductoresPage] Error al cargar conductores:', err);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, selectedLetter, currentPage, sortOrder]);

  useEffect(() => { loadDrivers(); }, []);

  // Carga los documentos con observación una sola vez por sesión (endpoint paginado).
  // Construye un mapa driverId -> peor estado para mostrar badges en las cards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await documentService.getPendingDocuments({ limit: 200 });
        if (cancelled) return;
        const priority = { rejected: 3, needs_review: 2, pending: 1, processing: 1 };
        const next = {};
        for (const d of data || []) {
          const drvId = typeof d.driver_id === 'object' ? d.driver_id?._id : d.driver_id;
          if (!drvId) continue;
          const flag = d.status === 'rejected' ? 'rejected'
                     : d.status === 'needs_review' ? 'needs_review'
                     : 'pending';
          if (!next[drvId] || priority[flag] > priority[next[drvId]]) {
            next[drvId] = flag;
          }
        }
        setDocFlagsByDriver(next);
      } catch (err) {
        // El endpoint puede no existir aún; el service ya hace fallback a mock.
        console.warn('[ConductoresPage] no se pudieron cargar docs pendientes:', err?.message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage !== 1) {
        setCurrentPage(1);
      } else {
        loadDrivers();
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedLetter]);

  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    } else {
      loadDrivers();
    }
  }, [sortOrder]);

  useEffect(() => {
    loadDrivers();
    // Subir al inicio de la página para dar feedback visual de cambio
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const handleOpenModal = (driver = null) => {
    setSelectedDriver(driver);
    setModalTab('info');
    setIsModalOpen(true);
  };

  const handleViewTrips = (driver) => {
    setSelectedDriver(driver);
    setModalTab('history');
    setIsModalOpen(true);
  };

  const handleViewDocuments = (driver) => {
    setSelectedDriver(driver);
    setModalTab('documents');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDriver(null);
  };

  const handleSaved = () => {
    loadDrivers();
  };

  const handleActivate = async (driver) => {
    Swal.fire({
      title: '¿Reactivar conductor?',
      text: `Estás a punto de activar a ${driver.name}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10B981',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, activar',
      cancelButtonText: 'Cancelar',
      background: 'rgba(255, 255, 255, 0.9)',
      backdrop: `blur(4px)`
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await driverService.activateDriver(driver._id);
          toast.success('Conductor reactivado correctamente');
          loadDrivers();
        } catch (err) {
          console.error('Error activating driver:', err);
          toast.error('No se pudo reactivar al conductor');
        }
      }
    });
  };

  const handleDelete = async (driver) => {
    Swal.fire({
      title: '¿Eliminar conductor?',
      text: `Esta acción desactivará a ${driver.name} del sistema.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: 'rgba(255, 255, 255, 0.9)',
      backdrop: `blur(4px)`
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await driverService.deleteDriver(driver._id);
          toast.success('Conductor desactivado correctamente');
          loadDrivers();
        } catch (err) {
          console.error('Error deleting driver:', err);
          toast.error('No se pudo eliminar al conductor');
        }
      }
    });
  };

  // Filtrado local sobre la página ya cargada. Hace que la barra responda
  // de inmediato aunque el backend tarde o falle: el usuario siempre ve
  // resultados filtrados dentro de los conductores visibles en esta página.
  // NOTA: No incluimos `phone` en el haystack para mantener paridad con el
  // backend (`userController.getAllUsers` solo hace $regex sobre name/username/
  // email). Si lo incluyéramos, buscar un dígito traería falsos positivos por
  // los números del teléfono — p.ej. buscar "3" matcheaba al conductor 4 porque
  // su teléfono termina en 3.
  const filteredDrivers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return drivers;
    return drivers.filter(d => {
      const haystack = `${d.name || ''} ${d.username || ''} ${d.email || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [drivers, searchTerm]);

  // Lógica para generar números de página con elipsis (...)
  const getPageNumbers = useMemo(() => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 3) end = 4;
      if (currentPage >= totalPages - 2) start = totalPages - 3;
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, currentPage]);

  const handleCerrarSesion = logout || cerrarSesion;

  return (
    <>
      <Toaster position="top-right" />

      <div id="encabezadoPagina" className="page-header">
        <div className="page-header-title">
          <h1>Gestión de Conductores</h1>
          <p>Gestiona y monitorea el rendimiento y disponibilidad de la flota</p>
        </div>

        <div className="page-header-actions">
          <div className="buscadorContainer">
            <Search size={18} className="buscadorIcono" />
            <input
              type="text"
              placeholder="Filtrar conductores..."
              value={searchTerm}
              onChange={e => {
                setSearch(e.target.value);
                if (e.target.value && selectedLetter) setSelectedLetter('');
              }}
            />
            <button className="btn-search-header" onClick={loadDrivers}>
              Buscar
            </button>
            <div className="search-status-indicator" style={{ right: '85px' }}>
              {loading && <div className="spinner-mini" />}
            </div>
          </div>

          <div className="ordenamientoContainer">
            <select
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              className="ordenamientoSelect"
            >
              <option value="desc">Más nuevos primero</option>
              <option value="asc">Más viejos primero</option>
            </select>
          </div>

          <button
            className={`btn-doc-filter ${showOnlyWithDocIssues ? 'is-active' : ''}`}
            onClick={() => setShowOnlyWithDocIssues(v => !v)}
            title="Mostrar solo conductores con documentos pendientes o rechazados"
          >
            <FileCheck size={16} />
            Docs pendientes
            {Object.keys(docFlagsByDriver).length > 0 && (
              <span className="btn-doc-filter-count">{Object.keys(docFlagsByDriver).length}</span>
            )}
          </button>

          <button className="btn-add-passenger" onClick={() => handleOpenModal(null)}>
            <Plus size={18} /> Registrar Conductor
          </button>
        </div>
      </div>

      {/* --- ALPHABET FILTER --- */}
      <div className="alphabet-filter">
        <button
          className={`letter-btn ${selectedLetter === '' ? 'active' : ''}`}
          onClick={() => setSelectedLetter('')}
        >
          Todos
        </button>
        {['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map(letter => (
          <button
            key={letter}
            className={`letter-btn ${selectedLetter === letter ? 'active' : ''}`}
            onClick={() => {
              const newLetter = selectedLetter === letter ? '' : letter;
              setSelectedLetter(newLetter);
              if (newLetter) setSearch(''); 
            }}
          >
            {letter}
          </button>
        ))}
      </div>

      <div className="graficosGrid">
        <div className="tarjetaEstadistica">
          <div className="estadisticaHeader">
            <div className="estadisticaIcono color-purple"><Users size={20} /></div>
            <div className="estadisticaValor">{loading ? '—' : stats.total}</div>
          </div>
          <div className="estadisticaTitulo">Total Conductores</div>
          <div className="estadisticaFooter">
            <span className="estadisticaSubtitulo">Conductores registrados</span>
          </div>
        </div>

        <div className="tarjetaEstadistica">
          <div className="estadisticaHeader">
            <div className="estadisticaIcono color-green"><Zap size={20} /></div>
            <div className="estadisticaValor">{loading ? '—' : stats.activeNow}</div>
          </div>
          <div className="estadisticaTitulo">Activos Ahora</div>
          <div className="estadisticaFooter">
            <span className="estadisticaSubtitulo">Monitoreo en vivo</span>
          </div>
        </div>

        <div className="tarjetaEstadistica">
          <div className="estadisticaHeader">
            <div className="estadisticaIcono color-yellow"><Star size={20} /></div>
            <div className="estadisticaValor">{loading ? '—' : stats.avgRating}</div>
          </div>
          <div className="estadisticaTitulo">Rating Promedio</div>
          <div className="estadisticaFooter">
            <span className="estadisticaSubtitulo">Todas las valoraciones</span>
          </div>
        </div>
      </div>

      <div id="gridConductores" className="passengers-section">
        <div className={`conductoresGrid ${loading ? 'conductoresGrid--loading' : 'conductoresGrid--loaded'}`}>
          {loading ? (
            // Mostrar 6 esqueletos mientras carga
            Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={`sk-${i}`} />)
          ) : filteredDrivers.length > 0 ? (
            filteredDrivers
              .filter(d => !showOnlyWithDocIssues || docFlagsByDriver[d._id])
              .map((driver, index) => (
                <DriverCard
                  key={driver._id}
                  driver={driver}
                  index={index}
                  docFlag={docFlagsByDriver[driver._id]}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                  onActivate={handleActivate}
                  onView={handleViewTrips}
                  onViewDocuments={handleViewDocuments}
                />
              ))
          ) : (
            <div className="empty-state-dashboard">
              <Truck size={48} />
              <h3>No se encontraron conductores</h3>
              <p>Intenta con otros filtros o registra uno nuevo.</p>
            </div>
          )}
        </div>
      </div>

      {/* --- PAGINACIÓN --- */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <button 
            className="pagination-btn" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            title="Primera página"
          >
            <ChevronsLeft size={18} />
          </button>
          
          <button 
            className="pagination-btn" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          
          <div className="pagination-numbers">
            {getPageNumbers.map((num, i) => (
              num === '...' ? (
                <span key={`dots-${i}`} className="pagination-dots">...</span>
              ) : (
                <button
                  key={`page-${num}`}
                  className={`page-num ${currentPage === num ? 'active' : ''}`}
                  onClick={() => setCurrentPage(num)}
                >
                  {num}
                </button>
              )
            ))}
          </div>

          <button 
            className="pagination-btn" 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            <ChevronRight size={18} />
          </button>

          <button 
            className="pagination-btn" 
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
            title="Última página"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      )}

      <DriverProfileModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        driver={selectedDriver}
        onSaved={handleSaved}
        initialTab={modalTab}
      />
    </>
  );
};

export default ConductoresPage;
