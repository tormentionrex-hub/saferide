/**
 * index.js — Entry point del agente SafeScore.
 *
 * Se requiere UNA vez desde server.js del backend:
 *
 *   // [SAFESCORE-AGENT] — Cargar agente si está habilitado
 *   try { require('./safescore-reviewer/agent').init(); } catch (err) {
 *     console.error('[SAFESCORE] init failed:', err.message);
 *   }
 *
 * Si SAFESCORE_ENABLED=false, init() es no-op.
 * Si la carpeta safescore-reviewer/ no existe, el try/catch en server.js lo absorbe.
 */

const logger = require('./utils/logger');

let initialized = false;

function init() {
  // Guard: opt-in
  if (process.env.SAFESCORE_ENABLED !== 'true') {
    logger.info('Agent disabled (SAFESCORE_ENABLED != "true"). Standby mode.');
    return false;
  }

  if (initialized) {
    logger.warn('Agent.init() llamado dos veces. Ignorando.');
    return true;
  }

  try {
    logger.success(`🚀 Agent v0.1.0 initialized`);

    // Suscribir listeners al EventEmitter del backend
    const { setupListeners } = require('./listeners');
    setupListeners();

    // Arrancar worker loop
    const worker = require('./queue/worker');
    worker.start();

    // Validar que las API keys estén configuradas (sin gastar tokens)
    const missing = [];
    if (!process.env.GROQ_API_KEY)     missing.push('GROQ_API_KEY');
    if (!process.env.GEMINI_API_KEY)   missing.push('GEMINI_API_KEY');
    if (!process.env.CEREBRAS_API_KEY) missing.push('CEREBRAS_API_KEY');
    if (missing.length > 0) {
      logger.warn(`⚠️  API keys faltantes: ${missing.join(', ')} — el agente podrá encolar pero las skills LLM fallarán hasta configurarlas`);
    } else {
      logger.success('🧠 LLM providers configured: groq ✓ gemini ✓ cerebras ✓ (sin llamadas, solo verifico keys)');
    }

    initialized = true;
    return true;
  } catch (err) {
    logger.error('Agent.init() falló', err);
    return false;
  }
}

function isInitialized() {
  return initialized;
}

module.exports = { init, isInitialized };
