/**
 * cronJobs.js — Wrappers de skills programables para que scheduledJobs.js
 *               del backend del equipo las registre con node-cron.
 *
 * Cada función:
 *   1. Encola un job en la cola del agente
 *   2. El worker eventualmente lo procesa
 *
 * Se exponen funciones (no se programan acá) para que el archivo del equipo
 * mantenga el control del scheduling.
 */

const queue = require('./queue/agentQueue');
const logger = require('./utils/logger');

/**
 * Cron cada 15 min: publica reviews pending_blind cuya ventana 24h expiró.
 */
async function publishBlindReviewsJob() {
  try {
    await queue.enqueue('publish-blind-reviews', {}, { priority: 4, tags: ['cron', '15min'] });
  } catch (err) {
    logger.error('cron publish-blind-reviews falló al encolar', err);
  }
}

/**
 * Cron 3 AM: análisis nocturno de fraude.
 */
async function antifraudNightlyJob() {
  try {
    await queue.enqueue('antifraud-nightly', {
      lookbackDays: 7,   // analiza última semana
    }, { priority: 2, tags: ['cron', 'nightly'] });
  } catch (err) {
    logger.error('cron antifraud-nightly falló al encolar', err);
  }
}

/**
 * Cron 4 AM: evaluación diaria de badges.
 */
async function awardBadgesJob() {
  try {
    await queue.enqueue('award-badges', {}, { priority: 2, tags: ['cron', 'daily'] });
  } catch (err) {
    logger.error('cron award-badges falló al encolar', err);
  }
}

/**
 * Cron 1° de cada mes: digest mensual por compañía.
 */
async function digestMonthlyJob() {
  try {
    await queue.enqueue('digest-monthly', {
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
    }, { priority: 1, tags: ['cron', 'monthly'] });
  } catch (err) {
    logger.error('cron digest-monthly falló al encolar', err);
  }
}

module.exports = {
  publishBlindReviewsJob,
  antifraudNightlyJob,
  awardBadgesJob,
  digestMonthlyJob,
};
