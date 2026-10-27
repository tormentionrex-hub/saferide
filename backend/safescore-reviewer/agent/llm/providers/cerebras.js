/**
 * cerebras.js — Cliente de Cerebras Cloud.
 *
 * Free tier (verificado mayo 2026):
 *   - Llama 3.3 70B:    1M tokens/día, 30 RPM
 *   - Llama 3.1 8B:     1M tokens/día, 30 RPM
 *   - Qwen3 32B:        free tier
 *
 * No requiere tarjeta. Más capacidad diaria que Groq.
 * Uso: fallback automático cuando Groq se queda sin cuota.
 *
 * API: 100% compatible con OpenAI Chat Completions.
 */

const Cerebras = require('@cerebras/cerebras_cloud_sdk');
const logger = require('../../utils/logger');

let client = null;

function getClient() {
  if (client) return client;
  const key = process.env.CEREBRAS_API_KEY;
  if (!key) throw new Error('CEREBRAS_API_KEY no configurado en .env');
  // SDK Cerebras exporta como default
  const CerebrasClient = Cerebras.default || Cerebras;
  client = new CerebrasClient({ apiKey: key });
  return client;
}

const MODELS = {
  reasoning_fast:    'llama3.1-8b',
  reasoning_primary: 'llama-3.3-70b',
  reasoning_deep:    'llama-3.3-70b',  // mismo (no hay reasoning especializado free)
};

function resolveModel(modelOrAlias) {
  return MODELS[modelOrAlias] || modelOrAlias;
}

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

  if (jsonMode) {
    params.response_format = { type: 'json_object' };
  }

  const start = Date.now();
  try {
    const response = await c.chat.completions.create(params);
    const text = response.choices?.[0]?.message?.content || '';
    const tokensUsed = response.usage?.total_tokens || 0;
    const durationMs = Date.now() - start;

    logger.debug('cerebras.complete OK', { model: resolvedModel, tokens: tokensUsed, ms: durationMs });

    return {
      text,
      tokensUsed,
      model: resolvedModel,
      provider: 'cerebras',
      durationMs,
      raw: response,
    };
  } catch (err) {
    logger.warn('cerebras.complete falló', { model: resolvedModel, error: err.message });
    throw err;
  }
}

async function ping() {
  const r = await complete({
    model: 'reasoning_fast',
    userPrompt: 'Responde solo con: OK',
    maxTokens: 5,
    temperature: 0,
  });
  return r.text.includes('OK');
}

module.exports = { complete, ping, MODELS, resolveModel, providerName: 'cerebras' };
