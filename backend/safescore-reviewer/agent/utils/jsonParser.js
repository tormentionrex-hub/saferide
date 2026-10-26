/**
 * jsonParser.js — Parser JSON tolerante para outputs de LLM.
 *
 * Los LLMs a veces devuelven JSON con detalles que JSON.parse() no acepta:
 *   - Markdown code fences (```json ... ```)
 *   - Texto explicativo antes/después del JSON
 *   - Comas finales (trailing commas)
 *   - Quotes raras
 *
 * Este módulo extrae y parsea de forma defensiva, sin lanzar excepciones
 * en casos típicos de "el modelo agregó texto de más".
 */

/**
 * Intenta parsear un string como JSON, aplicando heurísticas de limpieza
 * progresivas hasta lograrlo. Si no logra, devuelve null y loguea el motivo.
 *
 * @param {string} raw            — output crudo del LLM
 * @param {object} opts
 * @param {boolean} opts.array    — si true, espera array; si false, espera object
 * @returns {object|array|null}
 */
function safeParseJSON(raw, { array = false } = {}) {
  if (!raw || typeof raw !== 'string') return null;

  // 1. Intento directo
  try { return JSON.parse(raw); } catch (_) {}

  // 2. Limpiar code fences
  let s = raw.trim();
  s = s.replace(/^```(?:json|javascript|js)?\s*/i, '');
  s = s.replace(/\s*```\s*$/i, '');
  try { return JSON.parse(s); } catch (_) {}

  // 3. Extraer el primer bloque {...} o [...] del texto
  const opener = array ? '[' : '{';
  const closer = array ? ']' : '}';
  const start = s.indexOf(opener);
  const end = s.lastIndexOf(closer);
  if (start !== -1 && end !== -1 && end > start) {
    const extracted = s.slice(start, end + 1);
    try { return JSON.parse(extracted); } catch (_) {}

    // 4. Remover trailing commas (común en outputs de modelos chicos)
    const cleaned = extracted
      .replace(/,(\s*[\]}])/g, '$1')
      .replace(/[“”]/g, '"')    // comillas curly → rectas
      .replace(/[‘’]/g, "'");
    try { return JSON.parse(cleaned); } catch (_) {}
  }

  return null;
}

/**
 * Como safeParseJSON pero lanza si no logra parsear. Para casos donde
 * el llamador necesita un guard claro.
 */
function parseJSONOrThrow(raw, opts) {
  const result = safeParseJSON(raw, opts);
  if (result === null) {
    const preview = (raw || '').slice(0, 200);
    throw new Error(`No se pudo parsear JSON. Preview: ${preview}`);
  }
  return result;
}

module.exports = { safeParseJSON, parseJSONOrThrow };
