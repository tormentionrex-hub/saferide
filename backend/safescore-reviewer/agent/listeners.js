/**
 * listeners.js — Suscribe el agente al EventEmitter global del backend.
 *
 * Se carga UNA sola vez desde server.js si SAFESCORE_ENABLED=true.
 * Si está deshabilitado, este archivo nunca se requiere.
 *
 * Eventos a los que escuchamos (los emite emit.js desde los controllers):
 *   - safescore.review.created    → encola moderate-comment + detect-retaliation
 *   - safescore.review.published  → encola recompute-reputation
 *   - safescore.complaint.created → encola draft-complaint-reply
 *   - safescore.review.appealed   → encola analyze-appeal
 */

const eventEmitter = require('../../src/events/eventEmitter');
const queue = require('./queue/agentQueue');
const logger = require('./utils/logger');

let initialized = false;

function setupListeners() {
  if (initialized) return;
  initialized = true;

  // ─────────────────────────────────────────────────────────────
  // safescore.review.created — disparado tras POST /reviews/v2
  // ─────────────────────────────────────────────────────────────
  eventEmitter.on('safescore.review.created', async (data) => {
    try {
      const { reviewId, hasComment, lowScore } = data;

      if (hasComment) {
        await queue.enqueue('moderate-comment', { reviewId: String(reviewId) }, { priority: 5 });
      }
      if (lowScore) {
        await queue.enqueue('detect-retaliation', { reviewId: String(reviewId) }, { priority: 7 });
      }
    } catch (err) {
      logger.error('listener safescore.review.created falló', err);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // safescore.review.published — counter-review llegó o expiró 24h
  // ─────────────────────────────────────────────────────────────
  eventEmitter.on('safescore.review.published', async (data) => {
    try {
      const { userIds } = data;
      if (Array.isArray(userIds) && userIds.length > 0) {
        await queue.enqueue('recompute-reputation', { userIds: userIds.map(String) }, { priority: 3 });
      }
    } catch (err) {
      logger.error('listener safescore.review.published falló', err);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // safescore.complaint.created — llegó una queja al admin
  // ─────────────────────────────────────────────────────────────
  eventEmitter.on('safescore.complaint.created', async (data) => {
    try {
      const { complaintId } = data;
      if (complaintId) {
        await queue.enqueue('draft-complaint-reply', { complaintId: String(complaintId) }, { priority: 6 });
      }
    } catch (err) {
      logger.error('listener safescore.complaint.created falló', err);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // safescore.review.appealed — usuario apeló una review recibida
  // ─────────────────────────────────────────────────────────────
  eventEmitter.on('safescore.review.appealed', async (data) => {
    try {
      const { reviewId, userId, reason } = data;
      if (reviewId) {
        await queue.enqueue('analyze-appeal', {
          reviewId: String(reviewId),
          userId: String(userId),
          reason,
        }, { priority: 8 });
      }
    } catch (err) {
      logger.error('listener safescore.review.appealed falló', err);
    }
  });

  logger.success('📡 Listeners suscritos: review.created, review.published, complaint.created, review.appealed');
}

module.exports = { setupListeners };
