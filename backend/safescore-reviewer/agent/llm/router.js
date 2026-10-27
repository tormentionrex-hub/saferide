/**
 * router.js — Punto único de entrada para que las skills llamen LLMs.
 *
 * Las skills NO importan providers directamente. Llaman a `router.complete({...})`
 * y el router decide qué provider usar según:
 *   - llmRequirements de la skill (preferred + fallback)
 *   - quotaTracker (evitar providers saturados)
 *   - Errores recientes (skip providers que vienen fallando)
 *
 * Si TODOS los providers fallan, lanza error agregando los mensajes
 * de cada intento para diagnóstico.
 */

const groq = require('./providers/groq');
const gemini = require('./providers/gemini');
const cerebras = require('./providers/cerebras');
const { buildChain } = require('./fallbackChain');
const quotaTracker = require('./quotaTracker');
const logger = require('../utils/logger');

const PROVIDERS = {
  groq,
  gemini,
  cerebras,
};

/**
 * Llamada unificada. Reemplaza la cadena de imports + ifs en cada skill.
 *
 * @param {object} params
 * @param {object} params.requirements   — llmRequirements de la skill (ver SKILL.md)
 * @param {string} params.systemPrompt   — opcional
 * @param {string} params.userPrompt     — requerido
 * @param {number} params.maxTokens
 * @param {number} params.temperature
 * @param {boolean} params.jsonMode      — fuerza JSON output cuando el provider lo soporta
 * @returns {Promise<{text, tokensUsed, model, provider, durationMs}>}
 */
async function complete({ requirements, systemPrompt, userPrompt, maxTokens, temperature, jsonMode = false }) {
  if (!requirements) throw new Error('router.complete: requirements faltante');
  if (!userPrompt)   throw new Error('router.complete: userPrompt faltante');

  const chain = buildChain(requirements);
  if (chain.length === 0) {
    throw new Error('router.complete: skill marcada como sin LLM (preferredProvider=none)');
  }

  const errors = [];
  for (const providerName of chain) {
    const provider = PROVIDERS[providerName];
    if (!provider) {
      errors.push(`${providerName}: provider no registrado`);
      continue;
    }

    try {
      const result = await provider.complete({
        model: requirements.preferredModel || 'reasoning_fast',
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
        jsonMode,
      });

      // Registrar uso en quota tracker
      quotaTracker.record(providerName, { tokens: result.tokensUsed });

      // Log de éxito (solo en debug; en prod los logs van por skill)
      logger.debug(`router — ${providerName} succeeded`, {
        model: result.model,
        tokens: result.tokensUsed,
        ms: result.durationMs,
      });

      return result;
    } catch (err) {
      const msg = err.message || String(err);
      errors.push(`${providerName}: ${msg.slice(0, 200)}`);

      // Registrar error en quota tracker
      quotaTracker.record(providerName, { error: true });

      // Si es un 429 (rate limit) lo logueamos como warn, sino como error
      const isRateLimit = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate');
      if (isRateLimit) {
        logger.warn(`router — ${providerName} rate limited, intentando siguiente provider`);
      } else {
        logger.warn(`router — ${providerName} falló, intentando siguiente`, { error: msg.slice(0, 150) });
      }
      // Continuar al siguiente provider del chain
    }
  }

  // Todos los providers fallaron
  const allErrors = errors.join(' | ');
  logger.error('router — TODOS los providers fallaron', { errors: allErrors.slice(0, 500) });
  throw new Error(`router.complete: todos los providers fallaron. ${allErrors}`);
}

/**
 * Health check de todos los providers. Útil para verify.js --smoke.
 * NO se llama automáticamente al iniciar (gasta tokens).
 */
async function smokeTest() {
  const results = {};
  for (const name of Object.keys(PROVIDERS)) {
    try {
      const ok = await PROVIDERS[name].ping();
      results[name] = { ok, error: null };
    } catch (err) {
      results[name] = { ok: false, error: err.message };
    }
  }
  return results;
}

module.exports = { complete, smokeTest, PROVIDERS };
