import api from './api';

/**
 * bookingService — Reservas y pagos para las páginas Reservas y Pagos.
 *
 *   GET /bookings            → getBookings()   (admin: todas las reservas)
 *   GET /bookings/admin/summary → getPaymentsSummary() (solo admin)
 *
 * Filtros que se envían (el backend los valida y responde 400 si no cumplen):
 *   page, limit, status, payment_status, payment_type, payment_method, from, to,
 *   sort, search. from/to llegan como fecha del calendario (AAAA-MM-DD) y se
 *   envían en ISO 8601 cubriendo el día completo en hora local.
 * Solo se mandan los que tienen valor, para no ensuciar la URL.
 */

export const PAYMENTS_SUMMARY_PATH = '/bookings/admin/summary';

const dayStart = (d) => new Date(`${d}T00:00:00`).toISOString();
const dayEnd = (d) => new Date(`${d}T23:59:59.999`).toISOString();
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) && !Number.isNaN(new Date(`${d}T00:00:00`).getTime());

const clean = (params = {}) => {
  const out = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all')
  );
  if (out.from) { if (isDay(out.from)) out.from = dayStart(out.from); else delete out.from; }
  if (out.to) { if (isDay(out.to)) out.to = dayEnd(out.to); else delete out.to; }
  return out;
};

export const getBookings = async (params = {}) => {
  const res = await api.get('/bookings', { params: clean(params) });
  const data = Array.isArray(res.data?.data) ? res.data.data : [];
  const pagination = res.data?.pagination || { total: data.length, page: 1, pages: 1 };
  return { data, pagination };
};

// Devuelve el resumen tal como lo manda el backend (sin inventar campos).
// null si la ruta todavía no existe (404): la página lo dice en pantalla.
export const getPaymentsSummary = async (params = {}) => {
  try {
    const res = await api.get(PAYMENTS_SUMMARY_PATH, { params: clean(params) });
    return res.data?.data ?? null;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
};

export default { getBookings, getPaymentsSummary, PAYMENTS_SUMMARY_PATH };
