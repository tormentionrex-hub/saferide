/**
 * gemini.js — Cliente de Google AI Studio (Gemini).
 *
 * Free tier (verificado mayo 2026):
 *   - gemini-2.5-flash:      500 RPD (probado, FUNCIONA en cuenta del proyecto)
 *   - gemini-2.5-flash-lite: 1,000 RPD
 *   - gemini-2.5-pro:        50 RPD
 *
 * NOTA: gemini-2.0-flash está bloqueado en la cuenta del proyecto (cuota=0).
 *       Usar SIEMPRE gemini-2.5-flash como default.
 *
 * No requiere tarjeta. Indefinido.
 *
 * Uso: SOLO para tareas que necesitan contexto largo o batch grandes
 * (apelaciones, anti-fraude nocturno, digest mensual). NO para chatbot.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../utils/logger');

let client = null;

function getClient() {
  if (client) return client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY no configurado en .env');
  client = new GoogleGenerativeAI(key);
  return client;
}

const MODELS = {
  reasoning_long_ctx: 'gemini-2.5-flash',         // default — confirmado funciona
  reasoning_fast:     'gemini-2.5-flash-lite',    // más rápido
  reasoning_deep:     'gemini-2.5-pro',           // 50/día — usar con cuidado
};

function resolveModel(modelOrAlias) {
  return MODELS[modelOrAlias] || modelOrAlias;
}

/**
 * Llamada principal. Interfaz unificada con el resto de providers.
 *
 * @param {object} params — ver groq.js para signature
 */
async function complete({ model, systemPrompt, userPrompt, maxTokens = 500, temperature = 0.2, jsonMode = false }) {
  const c = getClient();
  const resolvedModel = resolveModel(model);

  // Gemini concatena system + user en un solo "content" si no se usa system_instruction
  const generationConfig = {
    maxOutputTokens: maxTokens,
    temperature,
  };

  if (jsonMode) {
    generationConfig.responseMimeType = 'application/json';
  }

  const modelInstance = c.getGenerativeModel({
    model: resolvedModel,
    systemInstruction: systemPrompt || undefined,
    generationConfig,
  });

  const start = Date.now();
  try {
    const result = await modelInstance.generateContent(userPrompt);
    const response = result.response;
    const text = response.text() || '';
    const tokensUsed = (response.usageMetadata?.totalTokenCount) || 0;
    const durationMs = Date.now() - start;

    logger.debug('gemini.complete OK', { model: resolvedModel, tokens: tokensUsed, ms: durationMs });

    return {
      text,
      tokensUsed,
      model: resolvedModel,
      provider: 'gemini',
      durationMs,
      raw: response,
    };
  } catch (err) {
    logger.warn('gemini.complete falló', { model: resolvedModel, error: err.message });
    throw err;
  }
}

async function ping() {
  const r = await complete({
    model: 'reasoning_long_ctx',
    userPrompt: 'Responde solo con: OK',
    maxTokens: 100,  // gemini-2.5-flash usa thinking tokens, dejar margen
    temperature: 0,
  });
  return (r.text || '').includes('OK');
}

module.exports = { complete, ping, MODELS, resolveModel, providerName: 'gemini' };
