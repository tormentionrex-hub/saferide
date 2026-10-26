/**
 * enforcement.js — Acciones visibles que el agente toma cuando detecta
 *                  contenido toxic o borderline.
 *
 * Diseño: el agente NO suspende usuarios ni borra reseñas por sí mismo.
 *         Solo aplica medidas REVERSIBLES y deja todo en una alerta para
 *         que el admin decida. El humano siempre tiene la última palabra.
 *
 * Acciones que toma:
 *   1. Reduce el weight de la review tóxica (menos peso en el cálculo del rating)
 *   2. Incrementa strikes del reviewer (3 strikes = flagged para revisión humana)
 *   3. Crea ModerationAlert con recomendación contextual
 *   4. Notifica a todos los admins via la collection notifications existente
 *
 * NO toca el schema de User ni de Review del backend del equipo. Agrega
 * campos opcionales con $set directo en collections (mongoose strict los ignora,
 * pero quedan persistidos para consumo del agente y del dashboard admin).
 */

const mongoose = require('mongoose');
const ModerationAlert = require('../models/ModerationAlert');
const logger = require('../utils/logger');

/**
 * Genera una recomendación contextual para el admin para un evento INDIVIDUAL
 * de moderación (una review tóxica o borderline). Las advertencias por
 * PATRÓN sistemático (10 reseñas consecutivas tóxicas) se generan aparte
 * con generateWarningRecommendation().
 *
 * Reglas determinísticas (no LLM):
 *   - toxic     → priority 'high', acción individual sobre la reseña
 *   - borderline → priority 'medium', revisión humana
 *   - safe      → null (no alerta)
 */
function generateRecommendation({ decision, score, isLegacy }) {
  // Reseña toxic — siempre prioridad 'high', acción individual
  if (decision === 'toxic') {
    return {
      priority: 'high',
      action: 'Revisar la reseña y considerar ocultarla',
      rationale: `Insultos directos o lenguaje agresivo detectado (score ${score}).`,
      suggested_steps: [
        'Leer el comentario completo en la colección reviews',
        'Confirmar que la moderación del agente es correcta (no falso positivo)',
        isLegacy
          ? 'Considerar marcar la reseña como oculta (agregar review.hidden=true)'
          : 'Cambiar review.status a "suppressed" desde el panel',
        'La reseña ya tiene peso reducido (weight=0.1) en el cálculo de rating',
      ],
    };
  }

  // Borderline = caso ambiguo, requiere ojo humano
  if (decision === 'borderline') {
    return {
      priority: 'medium',
      action: 'Revisar manualmente el contexto del viaje',
      rationale: `Comentario hostil pero sin insultos directos (score ${score}). Caso ambiguo, requiere criterio humano.`,
      suggested_steps: [
        'Leer el comentario completo y el contexto del ride',
        'Revisar si hay contra-reseña del conductor que dé contexto',
        'Si es queja legítima → mantener publicada, no actuar',
        'Si parece venganza → marcar para revisión por equipo de soporte',
      ],
    };
  }

  // safe — no debería generar alerta
  return null;
}

/**
 * Genera la recomendación para una advertencia formal por patrón sistemático
 * de toxicidad (10 reseñas consecutivas con score alto).
 */
function generateWarningRecommendation({ reviewerName, avgScore, previousWarnings }) {
  const escalation = previousWarnings >= 1
    ? '⚠️ ADVERTENCIA REPETIDA — el usuario ya recibió advertencias previas y reincidió.'
    : 'Primera advertencia formal por patrón.';

  const action = previousWarnings >= 1
    ? 'Considerar suspensión del usuario (advertencia previa no corrigió el comportamiento)'
    : 'Emitir advertencia formal por escrito al usuario';

  return {
    priority: 'critical',
    action,
    rationale: `${escalation} Las últimas 10 reseñas del usuario son tóxicas con score promedio ${avgScore.toFixed(2)}. No hay críticas constructivas — solo insultos directos.`,
    suggested_steps: [
      `Revisar las 10 reseñas tóxicas del usuario ${reviewerName || ''} en la collection reviews`,
      'Confirmar que ninguna es falso positivo del agente IA',
      previousWarnings >= 1
        ? 'Suspender User.isActive = false desde el endpoint admin'
        : 'Enviar email formal de advertencia explicando las consecuencias',
      'Documentar la advertencia con timestamp en el historial del usuario',
      previousWarnings >= 1
        ? 'Ocultar todas las reseñas del usuario suspendido'
        : 'Si recibe otra ronda de 10 reseñas tóxicas en el futuro → suspensión inmediata',
    ],
  };
}

/**
 * Reduce el peso de la review en el cálculo de reputación.
 * Para legacy: agrega ai_moderation.weight = 0.1
 * Para v2: actualiza review.weight = 0.1
 */
async function reduceReviewWeight({ reviewId, source }) {
  const collectionName = source === 'legacy' ? 'reviews' : 'reviews_v2';
  const db = mongoose.connection.db;

  if (source === 'legacy') {
    await db.collection(collectionName).updateOne(
      { _id: reviewId },
      { $set: { 'ai_moderation.weight': 0.1, 'ai_moderation.weight_reduced_at': new Date() } }
    );
  } else {
    await db.collection(collectionName).updateOne(
      { _id: reviewId },
      { $set: { weight: 0.1, anomaly_flags: ['toxic_comment'] } }
    );
  }
}

/**
 * Incrementa el contador `moderation_strikes` del reviewer. Solo para auditoría
 * — NO toma acciones automáticas con este contador (eso lo hace la regla de
 * patrón en checkAndIssueWarning).
 *
 * Devuelve los strikes totales acumulados.
 */
async function applyStrikeToReviewer(reviewerId) {
  const db = mongoose.connection.db;

  const result = await db.collection('users').findOneAndUpdate(
    { _id: reviewerId },
    {
      $inc: { moderation_strikes: 1 },
      $set: { last_moderation_at: new Date() },
    },
    { returnDocument: 'after' }
  );

  const user = result?.value || result;
  const strikes = user?.moderation_strikes || 1;

  return { strikes };
}

/**
 * REGLA DE ADVERTENCIA POR PATRÓN SISTEMÁTICO
 *
 * Si las últimas 10 reseñas del reviewer son TODAS tóxicas con score ≥ 0.80,
 * el agente emite una advertencia formal. Esta es la única acción "fuerte"
 * automática del sistema (más allá del weight reducido individual).
 *
 * Anti-spam: solo emite si pasaron al menos 24h desde la última advertencia.
 *
 * @param {ObjectId} reviewerId
 * @param {object} logger
 * @returns {Promise<{ issued: boolean, alert?: object, reason?: string }>}
 */
async function checkAndIssueWarning(reviewerId, logger) {
  if (!reviewerId) return { issued: false, reason: 'no_reviewer_id' };

  const db = mongoose.connection.db;
  const REVIEWS_TO_CHECK = 10;
  const SCORE_THRESHOLD = 0.80;
  const WARNING_COOLDOWN_HOURS = 24;

  // 1. Cargar usuario
  const user = await db.collection('users').findOne({ _id: reviewerId });
  if (!user) return { issued: false, reason: 'reviewer_not_found' };

  // 2. Anti-spam: si recibió advertencia hace menos de 24h, no re-emitir
  if (user.last_warning_at) {
    const hoursSince = (Date.now() - new Date(user.last_warning_at).getTime()) / 3600_000;
    if (hoursSince < WARNING_COOLDOWN_HOURS) {
      return { issued: false, reason: `warning_cooldown_active (${Math.floor(WARNING_COOLDOWN_HOURS - hoursSince)}h restantes)` };
    }
  }

  // 3. Cargar las últimas 10 reseñas moderadas del reviewer
  //    (busca en ambas collections — reviews legacy y reviews_v2)
  const [legacyReviews, v2Reviews] = await Promise.all([
    db.collection('reviews')
      .find({ reviewer_id: reviewerId, ai_moderation: { $exists: true } })
      .sort({ createdAt: -1, date: -1 })
      .limit(REVIEWS_TO_CHECK)
      .toArray(),
    db.collection('reviews_v2')
      .find({ reviewer_id: reviewerId, 'moderation.decided_at': { $exists: true } })
      .sort({ createdAt: -1 })
      .limit(REVIEWS_TO_CHECK)
      .toArray(),
  ]);

  // Normalizar y combinar: sacar { score, decision, createdAt } de cada source
  const allModerated = [
    ...legacyReviews.map(r => ({
      score: r.ai_moderation?.toxicity_score ?? 0,
      decision: r.ai_moderation?.decision || 'pending',
      createdAt: r.createdAt || r.date,
    })),
    ...v2Reviews.map(r => ({
      score: r.moderation?.toxicity_score ?? 0,
      decision: r.moderation?.decision || 'pending',
      createdAt: r.createdAt,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, REVIEWS_TO_CHECK);

  // 4. Necesitamos al menos 10 reseñas moderadas para evaluar el patrón
  if (allModerated.length < REVIEWS_TO_CHECK) {
    return {
      issued: false,
      reason: `insufficient_history (${allModerated.length}/${REVIEWS_TO_CHECK} reseñas moderadas)`,
    };
  }

  // 5. Chequear el patrón: TODAS las 10 deben ser toxic con score >= 0.80
  const allHighlyToxic = allModerated.every(r =>
    r.decision === 'toxic' && r.score >= SCORE_THRESHOLD
  );

  if (!allHighlyToxic) {
    return {
      issued: false,
      reason: 'pattern_not_systematic',
      stats: {
        toxic_count: allModerated.filter(r => r.decision === 'toxic').length,
        high_score_count: allModerated.filter(r => r.score >= SCORE_THRESHOLD).length,
        total_checked: allModerated.length,
      },
    };
  }

  // 6. Confirmado el patrón — emitir advertencia
  const avgScore = allModerated.reduce((s, r) => s + r.score, 0) / allModerated.length;
  const previousWarnings = user.warnings_count || 0;

  // Marcar al usuario
  await db.collection('users').updateOne(
    { _id: reviewerId },
    {
      $set: {
        last_warning_at: new Date(),
        warning_reason: 'systematic_toxic_pattern_10',
      },
      $inc: { warnings_count: 1 },
    }
  );

  // Crear la ModerationAlert tipo 'user_flagged' con severity 'critical'
  const recommendation = generateWarningRecommendation({
    reviewerName: user.name,
    avgScore,
    previousWarnings,
  });

  const alert = await ModerationAlert.create({
    type: 'user_flagged',
    severity: 'critical',
    source_collection: 'users',
    source_id: reviewerId,
    reviewer_id: reviewerId,
    reviewee_id: null,
    comment_excerpt: `[Patrón sistemático] Las últimas ${REVIEWS_TO_CHECK} reseñas del usuario "${user.name || reviewerId}" son tóxicas (score promedio ${avgScore.toFixed(2)}).`,
    rating: null,
    decision: {
      category: 'toxic',
      toxicity_score: avgScore,
      reason: `${REVIEWS_TO_CHECK} reseñas consecutivas tóxicas con score >= ${SCORE_THRESHOLD}. Patrón sistemático sin contexto legítimo.`,
      flags: ['systematic_toxicity', `warning_count_${previousWarnings + 1}`],
      llm_provider: null,
      llm_model: null,
      llm_tokens: 0,
    },
    recommendation,
    reviewer_strikes: user.moderation_strikes || REVIEWS_TO_CHECK,
    reviewer_flagged: true,
    status: 'pending',
  });

  // Notificar admins
  const adminCount = await notifyAdminsAboutWarning({ user, alert, avgScore });

  logger?.warn?.(`enforcement: ADVERTENCIA FORMAL emitida al reviewer ${reviewerId}`, {
    warnings_count: previousWarnings + 1,
    avg_score: avgScore.toFixed(2),
    admins_notified: adminCount,
  });

  return {
    issued: true,
    alert: { _id: alert._id, severity: alert.severity },
    warnings_count: previousWarnings + 1,
    avg_score: avgScore,
    admins_notified: adminCount,
  };
}

/**
 * Notifica a admins sobre una advertencia formal (formato especial, no la
 * notificación de moderación individual).
 */
async function notifyAdminsAboutWarning({ user, alert, avgScore }) {
  const db = mongoose.connection.db;
  const admins = await db.collection('users')
    .find({ type: 'admin' })
    .project({ _id: 1 })
    .toArray();

  if (admins.length === 0) return 0;

  const message = `🚨 ADVERTENCIA FORMAL emitida al usuario "${user.name || user._id}". ` +
                  `10 reseñas consecutivas tóxicas (score promedio ${avgScore.toFixed(2)}). ` +
                  `Patrón sistemático sin contexto legítimo. ` +
                  `Recomendación: ${alert.recommendation.action}.`;

  const now = new Date();
  const notifications = admins.map(admin => ({
    user_id: admin._id,
    message,
    type: 'system',
    status: 'unread',
    date: now,
    relatedEntity: { entityType: 'moderation_alert', entityId: alert._id },
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection('notifications').insertMany(notifications);
  return admins.length;
}

/**
 * Crea una ModerationAlert con todo el contexto que el dashboard admin necesita.
 */
async function createModerationAlert({
  review,
  source,
  decision,
  reviewerStrikes,
  reviewerFlagged,
  recommendation,
  llmMeta,
}) {
  const alert = await ModerationAlert.create({
    type: decision.decision === 'toxic' ? 'review_toxic' : 'review_borderline',
    severity: recommendation.priority,
    source_collection: source === 'legacy' ? 'reviews' : 'reviews_v2',
    source_id: review._id,
    reviewer_id: review.reviewer_id,
    reviewee_id: review.reviewee_id,
    comment_excerpt: (review.comment || '').slice(0, 500),
    rating: review.rating ?? review.overall ?? null,
    decision: {
      category: decision.decision,
      toxicity_score: decision.toxicity_score,
      reason: decision.reason,
      flags: decision.flags || [],
      llm_provider: llmMeta?.provider || null,
      llm_model: llmMeta?.model || null,
      llm_tokens: llmMeta?.tokens || 0,
    },
    recommendation,
    reviewer_strikes: reviewerStrikes,
    reviewer_flagged: reviewerFlagged,
    status: 'pending',
  });
  return alert;
}

/**
 * Inserta una notificación para cada admin en la collection 'notifications'
 * existente del backend del equipo. Usa type='system' (válido en el enum del modelo).
 */
async function notifyAdmins({ alert, review }) {
  const db = mongoose.connection.db;

  // Buscar todos los admins activos
  const admins = await db.collection('users')
    .find({ type: 'admin' })
    .project({ _id: 1, name: 1 })
    .toArray();

  if (admins.length === 0) {
    logger.warn('notifyAdmins: no hay admins en la BD, skipping');
    return 0;
  }

  const severityEmoji = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️',
  }[alert.severity] || '⚠️';

  const message = `${severityEmoji} Reseña ${alert.decision.category.toUpperCase()} detectada. ` +
                  `Score: ${alert.decision.toxicity_score}. ` +
                  `Recomendación: ${alert.recommendation.action}. ` +
                  `Comentario: "${(review.comment || '').slice(0, 100)}${(review.comment || '').length > 100 ? '...' : ''}"`;

  const now = new Date();
  const notifications = admins.map(admin => ({
    user_id: admin._id,
    message,
    type: 'system',
    status: 'unread',
    date: now,
    relatedEntity: {
      entityType: 'moderation_alert',
      entityId: alert._id,
    },
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection('notifications').insertMany(notifications);
  return admins.length;
}

/**
 * Función principal: dada una decisión de moderación, ejecuta todas las acciones
 * de enforcement y devuelve el resumen para el dispatcher.
 *
 * @param {object} params
 * @param {object} params.review        - documento de la review (V2 o legacy lean)
 * @param {string} params.source        - 'v2' | 'legacy'
 * @param {object} params.decision      - { decision, toxicity_score, reason, flags }
 * @param {object} params.llmMeta       - { provider, model, tokens }
 * @param {object} params.logger
 * @returns {Promise<{ actions, alert, recommendation, reviewer_strikes }>}
 */
async function applyEnforcement({ review, source, decision, llmMeta }) {
  // Solo actuar si es toxic o borderline. Safe no genera nada.
  if (decision.decision === 'safe') {
    return { actions: ['none_safe_review'], alert: null, recommendation: null };
  }

  const actions = [];

  // 1. Reducir weight (solo si es toxic — borderline queda esperando review humana)
  if (decision.decision === 'toxic') {
    try {
      await reduceReviewWeight({ reviewId: review._id, source });
      actions.push('weight_reduced_to_0.1');
    } catch (err) {
      logger.error('enforcement: falló reduceReviewWeight', err);
    }
  }

  // 2. Strike al reviewer (solo contador, sin acción automática)
  let strikes = 0;
  if (decision.decision === 'toxic' && review.reviewer_id) {
    try {
      const r = await applyStrikeToReviewer(review.reviewer_id);
      strikes = r.strikes;
      actions.push(`reviewer_strikes_now=${strikes}`);
    } catch (err) {
      logger.error('enforcement: falló applyStrikeToReviewer', err);
    }
  }

  // 3. Generar recomendación INDIVIDUAL (sobre esta reseña)
  const recommendation = generateRecommendation({
    decision: decision.decision,
    score: decision.toxicity_score,
    isLegacy: source === 'legacy',
  });

  if (!recommendation) {
    return { actions, alert: null, recommendation: null, reviewer_strikes: strikes };
  }

  // 4. Crear ModerationAlert individual de esta reseña
  let alert = null;
  try {
    alert = await createModerationAlert({
      review,
      source,
      decision,
      reviewerStrikes: strikes,
      reviewerFlagged: false,   // el flag solo lo da la regla de patrón
      recommendation,
      llmMeta,
    });
    actions.push(`moderation_alert_created=${alert._id}`);
  } catch (err) {
    logger.error('enforcement: falló createModerationAlert', err);
  }

  // 5. Notificar admins de esta alerta individual
  if (alert) {
    try {
      const count = await notifyAdmins({ alert, review });
      actions.push(`admin_notifications_sent=${count}`);
    } catch (err) {
      logger.error('enforcement: falló notifyAdmins', err);
    }
  }

  // 6. REGLA DE PATRÓN: si el reviewer acumula 10 reseñas seguidas toxic
  //    con score alto, emitir advertencia formal (solo si fue toxic ahora).
  let warning = null;
  if (decision.decision === 'toxic' && review.reviewer_id) {
    try {
      warning = await checkAndIssueWarning(review.reviewer_id, logger);
      if (warning.issued) {
        actions.push('formal_warning_issued');
        actions.push(`warnings_count=${warning.warnings_count}`);
      } else {
        actions.push(`warning_check_skipped:${warning.reason}`);
      }
    } catch (err) {
      logger.error('enforcement: falló checkAndIssueWarning', err);
    }
  }

  return {
    actions,
    alert: alert ? { _id: alert._id, severity: alert.severity } : null,
    recommendation,
    reviewer_strikes: strikes,
    formal_warning: warning?.issued ? {
      alert_id: warning.alert._id,
      warnings_count: warning.warnings_count,
      avg_score: warning.avg_score,
    } : null,
  };
}

module.exports = {
  applyEnforcement,
  generateRecommendation,
  generateWarningRecommendation,
  checkAndIssueWarning,
  // exports para tests
  _internals: {
    reduceReviewWeight,
    applyStrikeToReviewer,
    createModerationAlert,
    notifyAdmins,
    notifyAdminsAboutWarning,
  },
};
