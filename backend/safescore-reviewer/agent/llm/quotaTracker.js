/**
 * quotaTracker.js — Contador en memoria de requests/tokens por proveedor.
 *
 * Para CUIDAR los free tiers durante desarrollo (no gastarlos todos
 * debugueando) y para que el router cambie al fallback cuando un
 * provider llega a cierto umbral de uso.
 *
 * Persistencia: in-memory por instancia del proceso. Se resetea
 * al reiniciar el backend. (Para producción multi-instance se
 * migraría a Redis o a una collection Mongo dedicada).
 *
 * Reset diario: chequea la fecha actual y resetea contadores cuando
 * cambia el día (zona horaria del proceso).
 */

const logger = require('../utils/logger');

// Límites diarios conocidos del free tier (mayo 2026).
// Mantener conservador: 80% del oficial para tener margen de seguridad.
const DAILY_LIMITS = {
  groq: {
    requests: 1000,    // Llama 4 Scout: 1,000 RPD; Llama 3.1 8B: 14,400 RPD
                       // Tomamos el más restrictivo como cota conservadora.
    tokens: 500000,    // estimación conservadora cross-models
  },
  gemini: {
    requests: 500,     // gemini-2.5-flash: 500 RPD
    tokens: 1000000,   // 1M context, no es el cuello
  },
  cerebras: {
    requests: 1700,    // ~30 RPM × ~57min uso/día
    tokens: 1000000,   // 1M tokens/día
  },
};

const GUARD_PCT = parseInt(process.env.SAFESCORE_QUOTA_GUARD_PCT || '80', 10) / 100;

// Estado en memoria
const state = {
  date: new Date().toISOString().slice(0, 10),  // YYYY-MM-DD
  providers: {
    groq:     { requests: 0, tokens: 0, errors: 0, last_error_at: null },
    gemini:   { requests: 0, tokens: 0, errors: 0, last_error_at: null },
    cerebras: { requests: 0, tokens: 0, errors: 0, last_error_at: null },
  },
};

function checkDayRollover() {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== state.date) {
    logger.info(`📅 quotaTracker — Day rollover ${state.date} → ${today}, reseteando contadores`);
    state.date = today;
    for (const p of Object.keys(state.providers)) {
      state.providers[p] = { requests: 0, tokens: 0, errors: 0, last_error_at: null };
    }
  }
}

function record(provider, { tokens = 0, error = false } = {}) {
  checkDayRollover();
  if (!state.providers[provider]) return;
  state.providers[provider].requests += 1;
  state.providers[provider].tokens += tokens;
  if (error) {
    state.providers[provider].errors += 1;
    state.providers[provider].last_error_at = new Date().toISOString();
  }
}

/**
 * Devuelve % usado del provider (0-1). Se calcula sobre el límite más restrictivo
 * (requests o tokens). Si pasa de GUARD_PCT, el router debería evitar este provider.
 */
function getUsageRatio(provider) {
  checkDayRollover();
  const limits = DAILY_LIMITS[provider];
  const usage = state.providers[provider];
  if (!limits || !usage) return 0;
  const reqRatio = usage.requests / limits.requests;
  const tokRatio = usage.tokens / limits.tokens;
  return Math.max(reqRatio, tokRatio);
}

/**
 * ¿El provider está cerca del límite (≥ GUARD_PCT)? Si sí, el router lo evita.
 */
function isSaturated(provider) {
  return getUsageRatio(provider) >= GUARD_PCT;
}

/**
 * ¿El provider tiene errores recientes (últimos 5 min)? Si sí, evitar.
 */
function isUnhealthy(provider) {
  const usage = state.providers[provider];
  if (!usage || !usage.last_error_at) return false;
  const ageMs = Date.now() - new Date(usage.last_error_at).getTime();
  return ageMs < 5 * 60 * 1000 && usage.errors >= 3;
}

/**
 * Snapshot para el endpoint admin/stats.
 */
function snapshot() {
  checkDayRollover();
  const out = {
    date: state.date,
    providers: {},
  };
  for (const p of Object.keys(state.providers)) {
    out.providers[p] = {
      ...state.providers[p],
      quota_pct: Math.round(getUsageRatio(p) * 100),
      saturated: isSaturated(p),
      unhealthy: isUnhealthy(p),
    };
  }
  return out;
}

module.exports = {
  record,
  getUsageRatio,
  isSaturated,
  isUnhealthy,
  snapshot,
  DAILY_LIMITS,
};
