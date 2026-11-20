import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertCircle, RefreshCcw, Inbox,
} from 'lucide-react';
import { getBookings } from '../../services/bookingService';
import { isDeletedUser } from '../../utils/deletedAccounts';
import {
  BOOKING_STATUS, PAYMENT_STATUS, PAYMENT_METHOD,
  STATUS_FILTERS, PAYMENT_STATUS_FILTERS, PAYMENT_METHOD_FILTERS,
  formatCRC, formatDateTime,
} from '../../constants/bookingLabels';
import './BookingsTable.css';

const PAGE_LIMIT = 15;
const SEARCH_DEBOUNCE_MS = 400;
const SEARCH_MAX = 60; // tope del backend (GET /bookings?search)

const Badge = ({ map, value }) => {
  const item = map[value];
  if (!item) return <span className="bk-badge tone-gray">{value || '—'}</span>;
  return <span className={`bk-badge tone-${item.tone}`}>{item.label}</span>;
};

const personName = (u) => {
  if (!u || typeof u !== 'object') return '—';
  if (isDeletedUser(u)) return 'Usuario eliminado';
  return u.name || u.username || '—';
};

// Ofrecido = lo que propuso el pasajero; Cobrado = lo que quedó tras aceptar
// (0 si fue cortesía). Se muestran tal como vienen del backend.
const BookingsTable = ({ mode = 'reservas', onFiltersChange }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(mode === 'pagos' ? 'completed' : '');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const requestId = useRef(0);

  const dateError = from && to && from > to ? 'La fecha "desde" es posterior a "hasta".' : null;

  // Búsqueda con espera: no pedir al backend en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filters = useMemo(() => ({
    status, payment_status: paymentStatus, payment_method: paymentMethod, search, from, to,
  }), [status, paymentStatus, paymentMethod, search, from, to]);

  useEffect(() => { onFiltersChange?.(dateError ? null : filters); }, [filters, dateError, onFiltersChange]);

  useEffect(() => {
    if (dateError) return undefined;
    const id = ++requestId.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, pagination } = await getBookings({ ...filters, page, limit: PAGE_LIMIT });
        if (cancelled || id !== requestId.current) return;
        setRows(data);
        setPages(Math.max(1, pagination.pages || 1));
        setTotal(pagination.total ?? data.length);
      } catch (err) {
        if (cancelled || id !== requestId.current) return;
        const s = err?.response?.status;
        setError(s === 403 ? 'No tienes permiso para ver las reservas.'
          : s === 400 ? (err.response?.data?.errors?.[0]?.message || 'Algún filtro no es válido.')
          : 'No se pudieron cargar las reservas. Revisa la conexión con el servidor.');
        setRows([]);
      } finally {
        if (!cancelled && id === requestId.current) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filters, page, dateError, reloadKey]);

  const setFilter = (setter) => (e) => { setter(e.target.value); setPage(1); };

  const pageNumbers = useMemo(() => {
    const out = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(pages, page + 2);
    if (start > 1) out.push(1, ...(start > 2 ? ['…'] : []));
    for (let i = start; i <= end; i++) out.push(i);
    if (end < pages) out.push(...(end < pages - 1 ? ['…'] : []), pages);
    return out;
  }, [page, pages]);

  const isPagos = mode === 'pagos';

  return (
    <section className="bk-section" aria-busy={loading}>
      <div className="controls-row bk-controls">
        <div className="search-wrapper">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            maxLength={SEARCH_MAX}
            placeholder="Buscar por nombre o correo del pasajero o conductor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar reservas"
          />
        </div>
        <div className="bk-filters">
          <select value={status} onChange={setFilter(setStatus)} aria-label="Estado de la reserva" className="bk-select">
            {STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={paymentStatus} onChange={setFilter(setPaymentStatus)} aria-label="Estado del pago" className="bk-select">
            {PAYMENT_STATUS_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={paymentMethod} onChange={setFilter(setPaymentMethod)} aria-label="Método de pago" className="bk-select">
            {PAYMENT_METHOD_FILTERS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <label className="bk-date">Desde
            <input type="date" value={from} max={to || undefined} onChange={setFilter(setFrom)} />
          </label>
          <label className="bk-date">Hasta
            <input type="date" value={to} min={from || undefined} onChange={setFilter(setTo)} />
          </label>
        </div>
      </div>
      {dateError && <p className="bk-inline-error" role="alert">{dateError}</p>}

      <div className="bk-card">
        {error ? (
          <div className="bk-state" role="alert">
            <AlertCircle size={32} className="bk-state-icon is-error" />
            <h3>No se pudo cargar</h3>
            <p>{error}</p>
            <button type="button" className="bk-retry" onClick={() => setReloadKey(k => k + 1)}>
              <RefreshCcw size={14} /> Reintentar
            </button>
          </div>
        ) : !loading && rows.length === 0 ? (
          <div className="bk-state">
            <Inbox size={32} className="bk-state-icon" />
            <h3>Sin resultados</h3>
            <p>No hay reservas que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="bk-table-wrap">
            <table className="bk-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Pasajero</th>
                  <th>Conductor</th>
                  <th>Ruta del viaje</th>
                  {!isPagos && <th>Asientos</th>}
                  {!isPagos && <th>Estado</th>}
                  <th className="num">Ofrecido</th>
                  <th className="num">Cobrado</th>
                  <th>Método</th>
                  <th>Pago</th>
                  {isPagos && <th>Revisado</th>}
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={`sk-${i}`} className="bk-skeleton"><td colSpan={isPagos ? 9 : 10}><span /></td></tr>
                  ))
                  : rows.map((b) => {
                    const ride = b.ride_id && typeof b.ride_id === 'object' ? b.ride_id : null;
                    return (
                      <tr key={b._id} className={loading ? 'is-dim' : ''}>
                        <td>
                          <div className="bk-strong">{ride?.fecha ? `${ride.fecha} ${ride.hora || ''}` : '—'}</div>
                          <div className="bk-muted">Reservada {formatDateTime(b.createdAt)}</div>
                        </td>
                        <td>{personName(b.passenger_id)}</td>
                        <td>{personName(ride?.driver_id)}</td>
                        <td className="bk-route">
                          <div>{ride?.origin?.name || b.passenger_origin || '—'}</div>
                          <div className="bk-muted">→ {ride?.destination?.name || b.passenger_destination || '—'}</div>
                        </td>
                        {!isPagos && <td className="num">{b.seats_booked ?? '—'}</td>}
                        {!isPagos && <td><Badge map={BOOKING_STATUS} value={b.status} /></td>}
                        <td className="num">{b.offered_amount != null ? formatCRC(b.offered_amount) : '—'}</td>
                        <td className="num bk-strong">{formatCRC(b.charged_amount)}</td>
                        <td>{PAYMENT_METHOD[b.payment_method] || '—'}</td>
                        <td>
                          <Badge map={PAYMENT_STATUS} value={b.payment_status} />
                          {b.payment_type === 'gifted' && <span className="bk-muted bk-gift">Cortesía</span>}
                        </td>
                        {isPagos && <td className="bk-muted">{formatDateTime(b.payment_reviewed_at)}</td>}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!error && pages > 1 && (
        <div className="pagination-container">
          <button className="pagination-btn" disabled={page === 1 || loading} onClick={() => setPage(1)} title="Primera página"><ChevronsLeft size={18} /></button>
          <button className="pagination-btn" disabled={page === 1 || loading} onClick={() => setPage(p => p - 1)} title="Anterior"><ChevronLeft size={18} /></button>
          <div className="pagination-numbers">
            {pageNumbers.map((n, i) => (n === '…'
              ? <span key={`d-${i}`} className="pagination-dots">…</span>
              : <button key={n} className={`page-num ${page === n ? 'active' : ''}`} disabled={loading} onClick={() => setPage(n)}>{n}</button>))}
          </div>
          <button className="pagination-btn" disabled={page === pages || loading} onClick={() => setPage(p => p + 1)} title="Siguiente"><ChevronRight size={18} /></button>
          <button className="pagination-btn" disabled={page === pages || loading} onClick={() => setPage(pages)} title="Última página"><ChevronsRight size={18} /></button>
        </div>
      )}
      {!error && <p className="bk-count">{total} {total === 1 ? 'reserva' : 'reservas'}</p>}
    </section>
  );
};

export default BookingsTable;
