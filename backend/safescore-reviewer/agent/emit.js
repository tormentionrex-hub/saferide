/**
 * emit.js — Helper opt-in para que el backend del equipo dispare eventos
 *           del agente sin acoplarse a sus internals.
 *
 * Patrón clave: ESTE archivo es lo único que el código del equipo importa.
 * Si SAFESCORE_ENABLED !== 'true', todas las funciones son no-op.
 * Si el agente no está disponible (carpeta borrada), las funciones tampoco fallan.
 *
 * Las modificaciones en src/controllers/reviewController.js (y otros del backend)
 * usan este archivo así:
 *
 *   // [SAFESCORE-AGENT] — emit event si el agente está habilitado
 *   try { require('../../safescore-reviewer/agent/emit').onReviewCreated(review); } catch (_) {}
 *
 * Esto garantiza:
 *   1. El backend funciona aunque la carpeta safescore-reviewer/ no exista
 *   2. SAFESCORE_ENABLED=false → 0 efectos secundarios
 *   3. Errores del agente NUNCA rompen el flujo del backend
 */

let agentLoaded = false;
let queue = null;
let eventEmitter = null;
let logger = null;

function isEnabled() {
  return process.env.SAFESCORE_ENABLED === 'true';
}

function lazyLoad() {
  if (agentLoaded || !isEnabled()) return;
  try {
    queue = require('./queue/agentQueue');
    eventEmitter = require('../../src/events/eventEmitter');
    logger = require('./utils/logger');
    agentLoaded = true;
  } catch (err) {
    // Si algo falla cargando el agente, lo apagamos en silencio.
    // El backend del equipo sigue funcionando.
    agentLoaded = false;
    queue = null;
  }
}

/**
 * Llamado desde reviewController.createReview después de crear la review.
 * Encola moderación si hay comentario; detección de retaliación si overall ≤ 2.
 *
 * @param {object} review — documento Mongoose de la review recién creada
 */
async function onReviewCreated(review) {
  if (!isEnabled()) return;
  lazyLoad();
  if (!queue) return;

  try {
    const hasComment = !!(review.comment && review.comment.trim().length > 0);
    const overall = review.overall || review.rating;
    const lowScore = overall && overall <= 2;

    // Eventos para los listeners (sincrónico, usa el EventEmitter del backend)
    if (eventEmitter) {
      eventEmitter.emit('safescore.review.created', {
        reviewId: review._id,
        reviewerId: review.reviewer_id,
        revieweeId: review.reviewee_id,
        rideId: review.ride_id,
        overall,
        hasComment,
        lowScore,
      });
    }

    // Encolar tareas directamente como backup (si los listeners se cargaron tarde)
    if (hasComment) {
      await queue.enqueue('moderate-comment', { reviewId: review._id.toString() }, { priority: 5 });
    }
    if (lowScore) {
      await queue.enqueue('detect-retaliation', { reviewId: review._id.toString() }, { priority: 7 });
    }
  } catch (err) {
    // NUNCA propagar errores al controller del backend
    logger?.error('emit.onReviewCreated falló', err);
  }
}

/**
 * Llamado cuando una review pasa a status 'published' (por la counter-review
 * o cuando expira el doble ciego).
 */
async function onReviewPublished({ reviewIds, userIds }) {
  if (!isEnabled()) return;
  lazyLoad();
  if (!queue) return;

  try {
    if (eventEmitter) {
      eventEmitter.emit('safescore.review.published', { reviewIds, userIds });
    }
    await queue.enqueue('recompute-reputation', { userIds }, { priority: 3 });
  } catch (err) {
    logger?.error('emit.onReviewPublished falló', err);
  }
}

/**
 * Llamado cuando se crea una queja (modelo Complaint, a implementar).
 */
async function onComplaintCreated(complaint) {
  if (!isEnabled()) return;
  lazyLoad();
  if (!queue) return;

  try {
    if (eventEmitter) {
      eventEmitter.emit('safescore.complaint.created', {
        complaintId: complaint._id,
        category: complaint.category,
      });
    }
    await queue.enqueue('draft-complaint-reply', { complaintId: complaint._id.toString() }, { priority: 6 });
  } catch (err) {
    logger?.error('emit.onComplaintCreated falló', err);
  }
}

/**
 * Llamado cuando un usuario apela una review.
 */
async function onReviewAppealed({ reviewId, userId, reason }) {
  if (!isEnabled()) return;
  lazyLoad();
  if (!queue) return;

  try {
    if (eventEmitter) {
      eventEmitter.emit('safescore.review.appealed', { reviewId, userId, reason });
    }
    await queue.enqueue('analyze-appeal', { reviewId, userId, reason }, { priority: 8 });
  } catch (err) {
    logger?.error('emit.onReviewAppealed falló', err);
  }
}

module.exports = {
  isEnabled,
  onReviewCreated,
  onReviewPublished,
  onComplaintCreated,
  onReviewAppealed,
};
