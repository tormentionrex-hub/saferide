import { useCallback, useEffect, useRef, useState } from 'react';
import { Wallet, CheckCircle, Clock, Gift } from 'lucide-react';
import BookingsTable from '../../components/BookingsTable';
import { getPaymentsSummary } from '../../services/bookingService';
import { formatCRC } from '../../constants/bookingLabels';
import '../VehiculosPage/Vehiculos.css';
import '../../components/BookingsTable/BookingsTable.css';

// GET /bookings/admin/summary → { totalBookings, amounts: { charged, paid,
// pending, waived, paidUsd }, byPaymentStatus: { pending, paid, waived }, ... }.
// byPaymentStatus cuenta todas las reservas (también pendientes o canceladas),
// así que solo se muestra junto a "Pagado", donde coincide con el monto.
// Lo que no venga se muestra "—" (nunca se rellena con un número inventado).
const num = (v) => (Number.isFinite(Number(v)) && v !== null ? Number(v) : null);
const pick = (summary, key) => ({
  amount: num(summary?.amounts?.[key]),
  count: num(summary?.byPaymentStatus?.[key]),
});
const USD = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'USD' });

const Card = ({ icon: Icon, tone, label, value, sub }) => (
  <div className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={24} /></div>
    <div className="stat-info">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="bk-muted">{sub}</span>}
    </div>
  </div>
);

const fmt = (x) => (x.amount == null ? '—' : formatCRC(x.amount));
const cnt = (x) => (x.count == null ? null : `${x.count} ${x.count === 1 ? 'reserva' : 'reservas'}`);

const Pagos = () => {
  const [summary, setSummary] = useState(undefined); // undefined = cargando, null = no disponible
  const [summaryError, setSummaryError] = useState(null);
  const requestId = useRef(0);

  // Los totales siguen el rango de fechas de la tabla (el resumen solo acepta from/to).
  const loadSummary = useCallback(async (filters) => {
    if (!filters) return;
    const id = ++requestId.current;
    setSummaryError(null);
    try {
      // El resumen solo acepta from/to.
      const data = await getPaymentsSummary({ from: filters.from, to: filters.to });
      if (id === requestId.current) setSummary(data);
    } catch {
      if (id === requestId.current) { setSummary(null); setSummaryError('No se pudo cargar el resumen de pagos.'); }
    }
  }, []);

  useEffect(() => () => { requestId.current++; }, []);

  const paid = pick(summary, 'paid');
  const pending = pick(summary, 'pending');
  const waived = pick(summary, 'waived');
  const charged = num(summary?.amounts?.charged);
  const paidUsd = num(summary?.amounts?.paidUsd);
  const loading = summary === undefined;

  return (
    <div className="vehiculos-container">
      <div className="vehiculos-header">
        <div>
          <h1>Historial de Pagos</h1>
          <p>Cobros de los viajes: lo pagado, lo pendiente y las cortesías.</p>
        </div>
      </div>

      <div className="stats-grid">
        <Card icon={CheckCircle} tone="active" label="Pagado" value={loading ? '…' : fmt(paid)}
          sub={[cnt(paid), paidUsd ? `${USD.format(paidUsd)} por PayPal` : null].filter(Boolean).join(' · ') || null} />
        <Card icon={Clock} tone="pending" label="Pendiente de cobro" value={loading ? '…' : fmt(pending)} sub="Viajes completados sin pagar" />
        <Card icon={Gift} tone="alert" label="Exonerado / cortesía" value={loading ? '…' : fmt(waived)} />
        <Card icon={Wallet} tone="fleet" label="Cobrado en viajes completados" value={loading ? '…' : (charged == null ? '—' : formatCRC(charged))}
          sub={summary?.totalBookings != null ? `${summary.totalBookings} reservas en el período` : null} />
      </div>
      <p className="pg-summary-note">Los totales siguen el rango de fechas elegido abajo; el estado y el método filtran solo la tabla.</p>
      {summaryError && <p className="pg-summary-note is-error" role="alert">{summaryError}</p>}
      {!loading && summary === null && !summaryError && (
        <p className="pg-summary-note">El resumen de pagos no está disponible en el servidor; la tabla sí muestra los cobros reales.</p>
      )}

      <BookingsTable mode="pagos" onFiltersChange={loadSummary} />
    </div>
  );
};

export default Pagos;
