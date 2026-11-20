// Etiquetas en español de los valores de Booking (backend/src/models/Bookings.js).
// tone: clase de color del badge en BookingsTable.css.

export const BOOKING_STATUS = {
  pending: { label: 'Pendiente', tone: 'amber' },
  confirmed: { label: 'Confirmada', tone: 'blue' },
  completed: { label: 'Completada', tone: 'green' },
  cancelled: { label: 'Cancelada', tone: 'gray' },
  canceled: { label: 'Cancelada', tone: 'gray' },
  deny: { label: 'Rechazada', tone: 'red' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Pendiente', tone: 'amber' },
  paid: { label: 'Pagado', tone: 'green' },
  waived: { label: 'Exonerado', tone: 'gray' },
};

export const PAYMENT_METHOD = {
  cash: 'Efectivo',
  sinpe: 'SINPE Móvil',
  card: 'Tarjeta',
  paypal: 'PayPal',
  google_pay: 'Google Pay',
  apple_pay: 'Apple Pay',
};

// Filtros (value '' = todos). "cancelled" agrupa también "canceled" en el backend.
export const STATUS_FILTERS = [
  { value: '', label: 'Todas' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'completed', label: 'Completadas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'deny', label: 'Rechazadas' },
];

export const PAYMENT_STATUS_FILTERS = [
  { value: '', label: 'Todo pago' },
  { value: 'pending', label: 'Pago pendiente' },
  { value: 'paid', label: 'Pagado' },
  { value: 'waived', label: 'Exonerado' },
];

export const PAYMENT_METHOD_FILTERS = [
  { value: '', label: 'Todo método' },
  ...Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label })),
];

const CRC = new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC', maximumFractionDigits: 0 });
export const formatCRC = (n) => (Number.isFinite(Number(n)) ? CRC.format(Number(n)) : '—');

export const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('es-CR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
