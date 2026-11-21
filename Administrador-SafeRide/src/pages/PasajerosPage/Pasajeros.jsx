import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Users, Search, Plus, Mail, Star, Activity,
  Eye, Edit, CheckCircle, Briefcase, Phone,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, PowerOff
} from 'lucide-react';
import Swal from 'sweetalert2';
import { toast, Toaster } from 'react-hot-toast';

import passengerService from '../../services/passengerService';
import DriverProfileModal from '../../components/DriverProfileModal';
import DefaultImageUser from '../../imgs/DefaultImageUser.png';

import '../DashboardPage/Dashboard.css';
import '../ConductoresPage/ConductoresPage.css';
import './Pasajeros.css';

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────
const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');
const PAGE_LIMIT = 9;
const SKELETON_COUNT = 6;
const SEARCH_DEBOUNCE_MS = 300;
const INITIAL_STATS = { total: null, activeNow: null, avgRating: null };

const SWAL_BASE = {
  showCancelButton: true,
  cancelButtonColor: '#64748B',
  cancelButtonText: 'Cancelar',
  background: 'rgba(255, 255, 255, 0.9)',
  backdrop: 'blur(4px)',
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const getDefaultImagen = (url) => (url && url.trim() !== '' ? url : DefaultImageUser);

const confirmAction = async ({ title, text, icon, confirmText, confirmColor }) => {
  const result = await Swal.fire({
    ...SWAL_BASE,
    title,
    text,
    icon,
    confirmButtonText: confirmText,
    confirmButtonColor: confirmColor,
  });
  return result.isConfirmed;
};

const buildPageNumbers = (currentPage, totalPages) => {
  const pages = [];
  const maxVisible = 5;
  if (totalPages <= maxVisible + 2) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
    return pages;
  }
  pages.push(1);
  if (currentPage > 3) pages.push('...');
  let start = Math.max(2, currentPage - 1);
  let end = Math.min(totalPages - 1, currentPage + 1);
  if (currentPage <= 3) end = 4;
  if (currentPage >= totalPages - 2) start = totalPages - 3;
  for (let i = start; i <= end; i++) pages.push(i);
  if (currentPage < totalPages - 2) pages.push('...');
  pages.push(totalPages);
  return pages;
};

// ─────────────────────────────────────────────────────────────
// Subcomponentes
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

const PassengerCard = React.memo(({ passenger, index, onEdit, onDelete, onActivate, onView }) => (
  <div className="conductor-card" style={{ '--card-index': index }}>
    <div className="card-header">
      <img
        src={getDefaultImagen(passenger.profileImage)}
        alt={passenger.name}
        className="conductor-img"
        loading="lazy"
      />
      <div className={`status-badge ${passenger.isActive ? 'active' : 'inactive'}`}>
        {passenger.isActive ? 'Activo' : 'Inactivo'}
      </div>
    </div>

    <div className="card-content">
      <h3 className="conductor-name">{passenger.name}</h3>
      <p className="conductor-role">
        <Mail size={13} style={{ marginRight: '6px' }} />
        {passenger.email}
      </p>

      <div className="vehicle-info-mini" style={{ marginTop: '12px' }}>
        <div className="info-item">
          <Phone size={14} />
          <span>{passenger.phone || 'Sin teléfono'}</span>
        </div>
        <div className="info-item">
          <Briefcase size={14} />
          <span>{passenger.company || 'Particular'}</span>
        </div>
      </div>
    </div>

    <div className="card-actions">
      {!passenger.isActive ? (
        <button
          className="action-btn activate"
          title="Activar"
          onClick={() => onActivate(passenger)}
          style={{ color: '#10B981', background: 'rgba(16, 185, 129, 0.1)' }}
        >
          <CheckCircle size={18} />
        </button>
      ) : (
        <button className="action-btn view" title="Ver Historial de Viajes" onClick={() => onView(passenger)}>
          <Eye size={18} />
        </button>
      )}
      <button className="action-btn edit" title="Editar" onClick={() => onEdit(passenger)}>
        <Edit size={18} />
      </button>
      {passenger.isActive && (
        <button className="action-btn delete" title="Desactivar" onClick={() => onDelete(passenger)}>
          <PowerOff size={18} />
        </button>
      )}
    </div>
  </div>
));

const StatCard = ({ icon: Icon, color, value, title, subtitle, loading }) => (
  <div className="tarjetaEstadistica">
    <div className="estadisticaHeader">
      <div className={`estadisticaIcono ${color}`}><Icon size={20} /></div>
      <div className="estadisticaValor">{loading || value == null ? '—' : value}</div>
    </div>
    <div className="estadisticaTitulo">{title}</div>
    <div className="estadisticaFooter">
      <span className="estadisticaSubtitulo">{subtitle}</span>
    </div>
  </div>
);

const StatsGrid = ({ loading, stats }) => (
  <div className="graficosGrid">
    <StatCard icon={Users}    color="color-blue"   value={stats.total}     title="Total Pasajeros" subtitle="Usuarios registrados" loading={loading} />
    <StatCard icon={Activity} color="color-green"  value={stats.activeNow} title="Cuentas Activas" subtitle="Pasajeros habilitados" loading={loading} />
    <StatCard icon={Star}     color="color-yellow" value={stats.avgRating} title="Rating Promedio" subtitle="Promedio global"      loading={loading} />
  </div>
);

const AlphabetFilter = ({ selected, onSelect }) => (
  <div className="alphabet-filter">
    <button
      className={`letter-btn ${selected === '' ? 'active' : ''}`}
      onClick={() => onSelect('')}
    >
      Todos
    </button>
    {ALPHABET.map((letter) => (
      <button
        key={letter}
        className={`letter-btn ${selected === letter ? 'active' : ''}`}
        onClick={() => onSelect(selected === letter ? '' : letter)}
      >
        {letter}
      </button>
    ))}
  </div>
);

const Pagination = ({ currentPage, totalPages, onChange }) => {
  const pages = useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );
  if (totalPages <= 1) return null;

  const atFirst = currentPage === 1;
  const atLast  = currentPage === totalPages;

  return (
    <div className="pagination-container">
      <button className="pagination-btn" disabled={atFirst} onClick={() => onChange(1)} title="Primera página">
        <ChevronsLeft size={18} />
      </button>
      <button className="pagination-btn" disabled={atFirst} onClick={() => onChange(currentPage - 1)}>
        <ChevronLeft size={18} />
      </button>

      <div className="pagination-numbers">
        {pages.map((num, i) =>
          num === '...' ? (
            <span key={`dots-${i}`} className="pagination-dots">...</span>
          ) : (
            <button
              key={`page-${num}`}
              className={`page-num ${currentPage === num ? 'active' : ''}`}
              onClick={() => onChange(num)}
            >
              {num}
            </button>
          ),
        )}
      </div>

      <button className="pagination-btn" disabled={atLast} onClick={() => onChange(currentPage + 1)}>
        <ChevronRight size={18} />
      </button>
      <button className="pagination-btn" disabled={atLast} onClick={() => onChange(totalPages)} title="Última página">
        <ChevronsRight size={18} />
      </button>
    </div>
  );
};

const EmptyState = () => (
  <div className="empty-state-dashboard">
    <Users size={48} />
    <h3>No se encontraron pasajeros</h3>
    <p>Intenta con otros filtros o verifica la conexión.</p>
  </div>
);

// ─────────────────────────────────────────────────────────────
// Página
// ─────────────────────────────────────────────────────────────
const PasajerosPage = () => {
  // ── Data ───────────────────────────────────────────────────
  const [passengers, setPassengers] = useState([]);
  const [stats, setStats] = useState(INITIAL_STATS);
  const [loading, setLoading] = useState(true);

  // ── Filtros / orden / paginación ──────────────────────────
  const [searchTerm, setSearch] = useState('');
  const [selectedLetter, setSelectedLetter] = useState('');
  const [sortOrder, setSortOrder] = useState('desc'); // desc: nuevos primero | asc: viejos primero
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // ── Modal ──────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('info');
  const [selectedPassenger, setSelectedPassenger] = useState(null);

  // ── Refs ───────────────────────────────────────────────────
  const lastRequestId = useRef(0);

  // ── Stats globales ─────────────────────────────────────────
  // Pide TODOS los pasajeros (limit alto) solo para calcular el rating
  // promedio real sobre toda la BD, no sobre los 9 visibles. Se refresca
  // solo en mount y tras mutaciones (activate/delete/save), no en cada
  // cambio de filtro/búsqueda/paginación, donde el promedio no cambia.
  // Km recorridos y CO2 ahorrado NO se muestran aquí — eso vive en el Panel.
  const loadGlobalStats = useCallback(async () => {
    try {
      const res = await passengerService.getAllPassengers({ limit: 10000, page: 1 });
      const all = Array.isArray(res?.data) ? res.data : [];

      const rated = all.filter(p => typeof p.rating === 'number' && p.rating > 0);
      const avg = rated.length > 0
        ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1)
        : null;

      setStats(prev => ({
        ...prev,
        total:     prev.total     ?? res.stats?.total     ?? all.length,
        activeNow: prev.activeNow ?? res.stats?.active    ?? all.filter(p => p.isActive).length,
        avgRating: avg,
      }));
    } catch (err) {
      console.error('[PasajerosPage] Error al cargar stats globales:', err);
    }
  }, []);

  // ── Carga de datos ─────────────────────────────────────────
  const loadPassengers = useCallback(async () => {
    const requestId = ++lastRequestId.current;
    setLoading(true);
    try {
      const response = await passengerService.getAllPassengers({
        search: searchTerm,
        initial: selectedLetter,
        page: currentPage,
        limit: PAGE_LIMIT,
        sort: sortOrder,
      });

      // Descartamos respuestas obsoletas (race entre filtros).
      if (requestId !== lastRequestId.current) return;

      if (!Array.isArray(response?.data)) {
        setPassengers([]);
        setStats(INITIAL_STATS);
        return;
      }

      setPassengers(response.data);
      if (response.pagination) {
        setTotalPages(response.pagination.pages || 1);
      }
      // Importante: avgRating NO se calcula aquí porque response.data trae solo
      // la página actual (9 pasajeros). Para que el rating refleje todos los
      // pasajeros de la BD usamos loadGlobalStats() que pide la lista completa.
      // Mantenemos el avgRating previo entre cargas para evitar parpadeos.
      setStats(prev => ({
        ...prev,
        total: response.stats?.total ?? response.pagination?.total ?? null,
        activeNow: response.stats?.active ?? null,
      }));
    } catch (err) {
      console.error('[PasajerosPage] Error al cargar pasajeros:', err);
      if (requestId === lastRequestId.current) setPassengers([]);
    } finally {
      if (requestId === lastRequestId.current) setLoading(false);
    }
  }, [searchTerm, selectedLetter, currentPage, sortOrder]);

  // ── Efectos ────────────────────────────────────────────────
  // Búsqueda y letra: debounce 300 ms, vuelve a página 1 si cambia.
  useEffect(() => {
    const id = setTimeout(() => {
      if (currentPage !== 1) setCurrentPage(1);
      else loadPassengers();
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedLetter]);

  // Cambio de orden: idéntica lógica de reset a página 1.
  useEffect(() => {
    if (currentPage !== 1) setCurrentPage(1);
    else loadPassengers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOrder]);

  // Cambio de página: carga + scroll al top.
  useEffect(() => {
    loadPassengers();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Stats globales: una vez al montar. Las mutaciones (activate/delete/save)
  // disparan loadGlobalStats() explícitamente, no es necesario reaccionar a
  // cambios de filtro/orden/página porque el promedio global no varía.
  useEffect(() => {
    loadGlobalStats();
  }, [loadGlobalStats]);

  // ── Handlers de modal ──────────────────────────────────────
  const openModal = (passenger = null, tab = 'info') => {
    setSelectedPassenger(passenger);
    setModalTab(tab);
    setIsModalOpen(true);
  };
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPassenger(null);
  };

  // ── Handlers de acción ─────────────────────────────────────
  const handleActivate = async (passenger) => {
    const ok = await confirmAction({
      title: '¿Reactivar pasajero?',
      text: `Estás a punto de activar a ${passenger.name}`,
      icon: 'question',
      confirmText: 'Sí, activar',
      confirmColor: '#10B981',
    });
    if (!ok) return;
    try {
      await passengerService.activatePassenger(passenger._id);
      toast.success('Pasajero reactivado correctamente');
      loadPassengers();
      loadGlobalStats();
    } catch (err) {
      console.error('Error activating passenger:', err);
      toast.error('No se pudo reactivar al pasajero');
    }
  };

  const handleDelete = async (passenger) => {
    const ok = await confirmAction({
      title: '¿Desactivar pasajero?',
      text: `Esta acción pondrá a ${passenger.name} como inactivo.`,
      icon: 'warning',
      confirmText: 'Sí, desactivar',
      confirmColor: '#EF4444',
    });
    if (!ok) return;
    try {
      await passengerService.deletePassenger(passenger._id);
      toast.success('Pasajero desactivado correctamente');
      loadPassengers();
      loadGlobalStats();
    } catch (err) {
      console.error('Error deleting passenger:', err);
      toast.error('No se pudo desactivar al pasajero');
    }
  };

  // Filtrado local sobre la página ya cargada. Garantiza respuesta inmediata
  // de la barra de búsqueda aunque el backend tarde o falle.
  // NOTA: No incluimos `phone` en el haystack para mantener paridad con el
  // backend (`userController.getAllUsers` solo hace $regex sobre name/username/
  // email). Incluir teléfono causaba falsos positivos al buscar dígitos —
  // p.ej. buscar "3" matcheaba pasajeros cuyo teléfono contenía un 3.
  const filteredPassengers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return passengers;
    return passengers.filter(p => {
      const haystack = `${p.name || ''} ${p.username || ''} ${p.email || ''} ${p.company || ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [passengers, searchTerm]);

  // ── Handlers de filtros ────────────────────────────────────
  // Búsqueda y filtro alfabético son mutuamente excluyentes: al activar uno
  // limpiamos el otro para evitar resultados confusos.
  const handleSearchChange = (value) => {
    setSearch(value);
    if (value && selectedLetter) setSelectedLetter('');
  };
  const handleLetterSelect = (letter) => {
    setSelectedLetter(letter);
    if (letter) setSearch('');
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <Toaster position="top-right" />

      <div className="page-header">
        <div className="page-header-title">
          <h1>Gestión de Pasajeros</h1>
          <p>Supervisa y administra los usuarios registrados en la plataforma</p>
        </div>

        <div className="page-header-actions">
          <div className="buscadorContainer">
            <Search size={18} className="buscadorIcono" />
            <input
              type="text"
              placeholder="Filtrar pasajeros..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
            <button className="btn-search-header" onClick={loadPassengers}>
              Buscar
            </button>
            <div className="search-status-indicator" style={{ right: '85px' }}>
              {loading && <div className="spinner-mini" />}
            </div>
          </div>

          <div className="ordenamientoContainer">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="ordenamientoSelect"
            >
              <option value="desc">Más nuevos primero</option>
              <option value="asc">Más viejos primero</option>
            </select>
          </div>

          <button className="btn-add-passenger" onClick={() => openModal(null, 'info')}>
            <Plus size={18} /> Nuevo Pasajero
          </button>
        </div>
      </div>

      <AlphabetFilter selected={selectedLetter} onSelect={handleLetterSelect} />

      <StatsGrid loading={loading} stats={stats} />

      <div className="passengers-section">
        <div className={`conductoresGrid ${loading ? 'conductoresGrid--loading' : 'conductoresGrid--loaded'}`}>
          {loading
            ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <CardSkeleton key={`skp-${i}`} />)
            : filteredPassengers.length > 0
              ? filteredPassengers.map((p, index) => (
                  <PassengerCard
                    key={p._id}
                    passenger={p}
                    index={index}
                    onEdit={(passenger) => openModal(passenger, 'info')}
                    onView={(passenger) => openModal(passenger, 'history')}
                    onDelete={handleDelete}
                    onActivate={handleActivate}
                  />
                ))
              : <EmptyState />}
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onChange={setCurrentPage}
      />

      <DriverProfileModal
        isOpen={isModalOpen}
        onClose={closeModal}
        driver={selectedPassenger}
        onSaved={() => { loadPassengers(); loadGlobalStats(); }}
        userType="pasajero"
        initialTab={modalTab}
      />
    </>
  );
};

export default PasajerosPage;
