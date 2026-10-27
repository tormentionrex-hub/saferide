/**
 * groq.js — Cliente de Groq Cloud.
 *
 * Free tier (verificado mayo 2026):
 *   - Llama 4 Scout 17B:    30 RPM / 30K TPM / 1,000 RPD
 *   - Llama 3.1 8B Instant: 30 RPM / 6K TPM  / 14,400 RPD
 *   - DeepSeek R1 Distill:  free tier disponible
 *
 * No requiere tarjeta. Sólo rate limits.
 * API: 100% compatible con OpenAI Chat Completions.
 */

const Groq = require('groq-sdk');
const logger = require('../../utils/logger');

let client = null;

function getClient() {
  if (client) return client;
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('GROQ_API_KEY no configurado en .env');
  client = new Groq({ apiKey: key });
  return client;
}

/**
 * Modelos del free tier mapeados a alias semánticos del agente.
 * Esto permite que las skills pidan 'reasoning_fast' sin saber el nombre exacto.
 */
const MODELS = {
  reasoning_fast:    'llama-3.1-8b-instant',     // moderación, clasificación, tags
  reasoning_primary: 'meta-llama/llama-4-scout-17b-16e-instruct', // razonamiento medio
  reasoning_deep:    'deepseek-r1-distill-llama-70b', // razonamiento profundo
};

/**
 * Resuelve un modelo dado un alias o nombre directo.
 */
function resolveModel(modelOrAlias) {
  return MODELS[modelOrAlias] || modelOrAlias;
}

/**
 * Llamada principal. Compatible con la interfaz unificada del router.
 *
 * @param {object} params
 * @param {string} params.model         — alias o nombre del modelo
 * @param {string} params.systemPrompt  — system message (opcional)
 * @param {string} params.userPrompt    — user message (requerido)
 * @param {number} params.maxTokens     — default 500
 * @param {number} params.temperature   — default 0.2
 * @param {boolean} params.jsonMode     — si true, fuerza respuesta JSON
 * @returns {Promise<{text, tokensUsed, model, provider}>}
 */
async function complete({ model, systemPrompt, userPrompt, maxTokens = 500, temperature = 0.2, jsonMode = false }) {
  const c = getClient();
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: userPrompt });

  const resolvedModel = resolveModel(model);

  const params = {
    model: resolvedModel,
    messages,
    max_tokens: maxTokens,
    temperature,
  };

  // Groq soporta response_format JSON para Llama 3.x y posteriores
  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  const start = Date.now();
  try {
    const response = await c.chat.completions.create(params);
    const text = response.choices?.[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    const durationMs = Date.now() - start;

    logger.debug('groq.complete OK', { model: resolvedModel, tokens: tokensUsed, ms: durationMs });

    return {
      text,
      tokensUsed,
      model: resolvedModel,
      provider: 'groq',
      durationMs,
      raw: response,
    };
  } catch (err) {
    logger.warn('groq.complete falló', { model: resolvedModel, error: err.message });
    throw err;
  }
}

/**
 * Health check para el smoke test inicial.
 */
async function ping() {
  const r = await complete({
    model: 'reasoning_fast',
    userPrompt: 'Responde solo con: OK',
    maxTokens: 5,
    temperature: 0,
  });
  return r.text.includes('OK');
}

module.exports = { complete, ping, MODELS, resolveModel, providerName: 'groq' };
