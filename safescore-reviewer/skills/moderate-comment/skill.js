/**
 * skill.js — T1 moderate-comment
 *
 * Modera comentarios de reseñas con un LLM (Groq Llama 3.1 8B por defecto).
 *
 * SOPORTA AMBOS ESQUEMAS DE REVIEW:
 *   1. reviews_v2 (multidimensional, doble ciego, status, moderation embed)
 *      → actualiza review.moderation y review.status directamente
 *
 *   2. reviews (legacy del backend del equipo, solo rating + comment)
 *      → AGREGA un campo nuevo `ai_moderation` con $set sin tocar el resto del doc.
 *      No modifica el schema del equipo. El equipo puede leer ese campo si quiere,
 *      o ignorarlo. La review queda intacta funcionalmente.
 *
 * Esto permite que CUALQUIER reseña creada desde el móvil hoy (que va a /reviews
 * legacy) sea moderada automáticamente por el agente sin romper nada del equipo.
 */

const mongoose = require('mongoose');
const ReviewV2 = require('../../agent/models/ReviewV2');
const promptLoader = require('../../agent/utils/promptLoader');
const { safeParseJSON } = require('../../agent/utils/jsonParser');
const { applyEnforcement } = require('../../agent/services/enforcement');
const { validateInput, validateOutput } = require('./schema');

// Lazy load del modelo Review legacy del backend del equipo. Si la carpeta
// del backend no existe (caso edge de test aislado), la skill solo usa ReviewV2.
let LegacyReview = null;
try {
  LegacyReview = require('../../../src/models/Review');
} catch (_) {
  LegacyReview = null;
}

// Mapa decisión → status final de la review V2
function applyDecisionToStatus(decision, currentStatus) {
  // Solo aplicamos si la review está en pending_blind (no pisar publicaciones manuales)
  if (currentStatus !== 'pending_blind') return currentStatus;
  if (decision === 'toxic')      return 'suppressed';
  if (decision === 'borderline') return 'moderation_queue';
  return 'pending_blind';
}

/**
 * Normaliza la salida del LLM (que puede traer variaciones de mayúsculas, etc.).
 */
function normalizeLLMOutput(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;

  let decision = (parsed.decision || '').toString().toLowerCase().trim();
  if (!['safe', 'borderline', 'toxic'].includes(decision)) {
    const score = Number(parsed.toxicity_score);
    if (!Number.isFinite(score)) return null;
    if (score < 0.30) decision = 'safe';
    else if (score < 0.70) decision = 'borderline';
    else decision = 'toxic';
  }

  let score = Number(parsed.toxicity_score);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    score = decision === 'safe' ? 0.15 : decision === 'borderline' ? 0.5 : 0.85;
  }

  const reason = (parsed.reason || '').toString().slice(0, 300);
  return { decision, toxicity_score: Math.round(score * 100) / 100, reason };
}

/**
 * Carga una review buscando primero en reviews_v2 y luego en reviews legacy.
 * Devuelve { doc, source }:
 *   - source: 'v2'      → es ReviewV2 (mongoose doc completo, podemos .save())
 *   - source: 'legacy'  → es review vieja (objeto lean, hay que updateOne para escribir)
 *   - null              → no existe en ninguna
 */
async function loadReview(reviewId) {
  // 1. Intentar ReviewV2 primero (es el modelo "nuevo")
  const v2 = await ReviewV2.findById(reviewId);
  if (v2) return { doc: v2, source: 'v2' };

  // 2. Caer a Review legacy si está disponible
  if (LegacyReview) {
    const legacy = await LegacyReview.findById(reviewId).lean();
    if (legacy) return { doc: legacy, source: 'legacy' };
  }

  return null;
}

/**
 * Aplica la decisión de moderación a la review.
 *
 * - V2:     update embed moderation + status
 * - Legacy: agrega campo ai_moderation con updateOne directo (no toca el schema)
 *
 * @returns {Promise<{ new_review_status: string|null }>}
 */
async function applyModerationDecision(loaded, decision, isAuto, logger) {
  const { doc, source } = loaded;

  const moderationPayload = {
    decision: decision.decision,
    toxicity_score: decision.toxicity_score,
    reason: decision.reason,
    decided_at: new Date(),
    auto: isAuto,
    flags: [],
  };

  if (source === 'v2') {
    doc.moderation = moderationPayload;
    doc.status = applyDecisionToStatus(decision.decision, doc.status);
    await doc.save();
    return { new_review_status: doc.status };
  }

  // source === 'legacy' — agregamos el campo ai_moderation con updateOne
  // directo en la collection nativa, evitando el schema strict del modelo
  // del equipo. Esto AGREGA un campo nuevo sin pisar nada del documento.
  const collection = mongoose.connection.db.collection('reviews');
  await collection.updateOne(
    { _id: doc._id },
    {
      $set: {
        ai_moderation: moderationPayload,
        // Tambien guardamos un timestamp visible para que el equipo pueda
        // detectar fácilmente que el documento tiene metadata del agente.
        ai_moderated_at: moderationPayload.decided_at,
      },
    }
  );
  logger.info(`moderate-comment: review legacy ${doc._id} marcada con ai_moderation`);
  return { new_review_status: null };  // legacy no tiene concepto de status
}

module.exports = {
  name: 'moderate-comment',

  llmRequirements: {
    preferredProvider: 'groq',
    preferredModel: 'reasoning_fast',
    fallback: ['cerebras', 'gemini'],
    maxTokens: 200,
    temperature: 0.1,
    jsonMode: true,
  },

  async execute({ input, llm, logger }) {
    // Validar input
    const v = validateInput(input);
    if (!v.ok) {
      throw new Error(`moderate-comment: input inválido — ${v.error}`);
    }
    const { reviewId } = v.data;

    // Cargar review (busca en V2 primero, después en legacy)
    const loaded = await loadReview(reviewId);
    if (!loaded) {
      logger.warn(`moderate-comment: review ${reviewId} no encontrada en V2 ni legacy`);
      return { skipped: true, reason: 'review_not_found' };
    }

    const { doc: review, source } = loaded;

    // Idempotencia
    if (source === 'v2' && review.moderation?.decided_at) {
      logger.debug(`moderate-comment: review V2 ${reviewId} ya moderada, skip`);
      return {
        skipped: true,
        reason: 'already_moderated',
        previous_decision: review.moderation.decision,
        source,
      };
    }
    if (source === 'legacy' && review.ai_moderation?.decided_at) {
      logger.debug(`moderate-comment: review legacy ${reviewId} ya moderada, skip`);
      return {
        skipped: true,
        reason: 'already_moderated',
        previous_decision: review.ai_moderation.decision,
        source,
      };
    }

    // Si no hay comentario, decisión rápida 'safe' sin LLM
    const comment = (review.comment || '').trim();
    if (!comment) {
      const emptyDecision = {
        decision: 'safe',
        toxicity_score: 0,
        reason: 'sin comentario',
      };
      await applyModerationDecision(loaded, emptyDecision, true, logger);
      return { decision: 'safe', toxicity_score: 0, reason: 'empty', applied: true, source };
    }

    // Cargar prompt
    const prompt = promptLoader.loadAndInterpolate('moderate-comment', { comment });

    // Llamar al LLM (router elige Groq por default)
    let llmResult;
    try {
      llmResult = await llm.complete({
        userPrompt: prompt,
        maxTokens: 200,
        temperature: 0.1,
        jsonMode: true,
      });
    } catch (err) {
      // Si TODOS los providers fallan, derivamos a queue de moderación humana
      logger.warn(`moderate-comment: LLM falló totalmente`, { error: err.message });
      const fallbackDecision = {
        decision: 'borderline',
        toxicity_score: 0.5,
        reason: 'LLM no disponible — derivado a admin',
      };
      await applyModerationDecision(loaded, fallbackDecision, false, logger);
      throw err;  // el worker registra el error en el AgentJob
    }

    // Parsear respuesta JSON tolerantemente
    const parsed = safeParseJSON(llmResult.text);
    const normalized = normalizeLLMOutput(parsed);

    if (!normalized) {
      logger.warn('moderate-comment: respuesta del LLM no parseable, derivando a queue', {
        raw: (llmResult.text || '').slice(0, 200),
      });
      const unparseable = {
        decision: 'borderline',
        toxicity_score: 0.5,
        reason: 'LLM respondió JSON inválido — derivado a admin',
      };
      await applyModerationDecision(loaded, unparseable, false, logger);
      return {
        decision: 'borderline',
        applied: true,
        source,
        raw_preview: (llmResult.text || '').slice(0, 100),
      };
    }

    // Validar output con schema (defense in depth)
    const vo = validateOutput(normalized);
    if (!vo.ok) {
      logger.warn('moderate-comment: output no pasó schema, igual aplicando', { error: vo.error });
    }

    // Aplicar la decisión sobre la review (moderation embed para V2, ai_moderation para legacy)
    const { new_review_status } = await applyModerationDecision(loaded, normalized, true, logger);

    logger.success(`moderate-comment: ${normalized.decision} (score=${normalized.toxicity_score}) source=${source}`, {
      reviewId: String(reviewId),
      provider: llmResult.provider,
      tokens: llmResult.tokensUsed,
    });

    // ─── ENFORCEMENT — Acciones visibles para el dashboard admin ────────
    // Si la decisión es toxic o borderline, tomamos acciones concretas:
    //   1. Reducir weight de la review (si toxic)
    //   2. Strike al reviewer (si toxic)
    //   3. Crear ModerationAlert con recomendación
    //   4. Notificar a todos los admins via collection 'notifications'
    // Si la decisión es safe, no se hace nada.
    let enforcement = null;
    try {
      enforcement = await applyEnforcement({
        review,
        source,
        decision: normalized,
        llmMeta: {
          provider: llmResult.provider,
          model: llmResult.model,
          tokens: llmResult.tokensUsed,
        },
      });
      if (enforcement.actions.length > 0 && enforcement.actions[0] !== 'none_safe_review') {
        logger.info(`enforcement aplicado: ${enforcement.actions.join(', ')}`);
      }
    } catch (err) {
      // El enforcement NO debe romper la skill principal.
      // Si falla, la moderación ya quedó aplicada en la review.
      logger.error('moderate-comment: enforcement falló (no bloquea)', err);
    }

    return {
      decision: normalized.decision,
      toxicity_score: normalized.toxicity_score,
      reason: normalized.reason,
      applied: true,
      source,
      new_review_status,
      enforcement: enforcement ? {
        actions: enforcement.actions,
        alert_id: enforcement.alert?._id,
        alert_severity: enforcement.alert?.severity,
        recommendation: enforcement.recommendation,
        reviewer_strikes: enforcement.reviewer_strikes,
        reviewer_flagged: enforcement.reviewer_flagged,
      } : null,
    };
  },
};
