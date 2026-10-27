/**
 * fallbackChain.js — Determina el orden de providers a probar según la tarea.
 *
 * Patrón: cada skill declara su `llmRequirements` (preferredProvider, fallback[]).
 * Este módulo genera la cadena ordenada respetando:
 *   1. Preferencia de la skill
 *   2. Saturación de cuota (evitar providers ≥ 80% usados)
 *   3. Salud reciente (evitar providers con errores recientes)
 *
 * Si todos los providers están saturados/unhealthy, devuelve el menos saturado
 * (mejor mandar al menos peor que fallar totalmente).
 */

const quotaTracker = require('./quotaTracker');
const logger = require('../utils/logger');

const ALL_PROVIDERS = ['groq', 'cerebras', 'gemini'];

/**
 * Construye la cadena de providers para una skill.
 *
 * @param {object} requirements
 * @param {string} requirements.preferredProvider — 'groq' | 'gemini' | 'cerebras' | 'none'
 * @param {string[]} requirements.fallback — ['cerebras', 'gemini']
 * @returns {string[]} cadena ordenada de providers a probar
 */
function buildChain({ preferredProvider, fallback = [] }) {
  if (preferredProvider === 'none') return [];

  // Cadena candidata: preferido + fallback + cualquier otro como último recurso
  const candidates = [preferredProvider, ...fallback];
  for (const p of ALL_PROVIDERS) {
    if (!candidates.includes(p)) candidates.push(p);
  }

  // Filtrar duplicados y providers inexistentes
  const seen = new Set();
  const valid = candidates.filter(p => {
    if (!ALL_PROVIDERS.includes(p)) return false;
    if (seen.has(p)) return false;
    seen.add(p);
    return true;
  });

  // Particionar: saludables y no saturados primero, luego el resto
  const healthy = [];
  const degraded = [];
  for (const p of valid) {
    if (quotaTracker.isSaturated(p) || quotaTracker.isUnhealthy(p)) {
      degraded.push(p);
    } else {
      healthy.push(p);
    }
  }

  const chain = [...healthy, ...degraded];

  if (degraded.length > 0) {
    logger.warn(`fallbackChain — providers degraded: ${degraded.join(',')} (cuota o errores)`);
  }

  return chain;
}

module.exports = { buildChain, ALL_PROVIDERS };
