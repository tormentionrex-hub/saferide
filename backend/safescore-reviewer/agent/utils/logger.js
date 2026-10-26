/**
 * logger.js — Wrapper del logger del backend con prefijo [SAFESCORE]
 *
 * Todo log del agente debe pasar por este módulo. Garantiza que
 * los logs sean filtrables vía grep y consistentes en formato.
 *
 * Si el logger del backend no está disponible (caso edge de test
 * aislado), cae a console como fallback seguro.
 */

const PREFIX = '[SAFESCORE]';

let backendLogger = null;
try {
  // Cargar el logger del backend si existe (ruta relativa desde agent/utils/)
  backendLogger = require('../../../src/utils/logger');
} catch (_) {
  // En tests o setups aislados puede no estar disponible
  backendLogger = null;
}

function ts() {
  return new Date().toISOString();
}

function format(level, msg, meta) {
  const metaStr = meta ? ' ' + JSON.stringify(meta) : '';
  return `${PREFIX} ${msg}${metaStr}`;
}

const logger = {
  info: (msg, meta) => {
    const line = format('info', msg, meta);
    if (backendLogger?.info) backendLogger.info(line);
    else console.log(line);
  },

  success: (msg, meta) => {
    const line = format('success', msg, meta);
    if (backendLogger?.success) backendLogger.success(line);
    else console.log(line);
  },

  warn: (msg, meta) => {
    const line = format('warn', msg, meta);
    if (backendLogger?.warn) backendLogger.warn(line);
    else console.warn(line);
  },

  error: (msg, meta) => {
    // Sanitizar errores: evitar loguear objetos enteros que puedan contener
    // headers con Bearer tokens (regla del proyecto SafeRide).
    let safeMeta = meta;
    if (meta instanceof Error) {
      safeMeta = { message: meta.message, name: meta.name };
    } else if (meta?.response?.data) {
      safeMeta = { status: meta.response.status, message: meta.response.data?.message || 'unknown' };
    }
    const line = format('error', msg, safeMeta);
    if (backendLogger?.error) backendLogger.error(line);
    else console.error(line);
  },

  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'development') return;
    const line = format('debug', msg, meta);
    if (backendLogger?.debug) backendLogger.debug(line);
    else console.debug(line);
  },
};

module.exports = logger;
