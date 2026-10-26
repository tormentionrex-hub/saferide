const cron = require('node-cron');
const logger = require('../utils/logger');
const calculateMetricsJob = require('./calculateMetrics');
const cleanupExpiredRidesJob = require('./cleanupExpiredRides');
const sendRideRemindersJob = require('./sendRideReminders');

// [SAFESCORE-AGENT] — Carga lazy de cron jobs del agente.
// Si la carpeta safescore-reviewer/ no existe o SAFESCORE_ENABLED=false, este require devuelve null.
let safescoreCron = null;
try {
  if (process.env.SAFESCORE_ENABLED === 'true') {
    safescoreCron = require('../../safescore-reviewer/agent/cronJobs');
  }
} catch (_) { /* agente no disponible — no es error, sigue el backend normal */ }
// [SAFESCORE-AGENT] — fin

/**
 * Initialize all scheduled jobs
 */
const initScheduledJobs = () => {
  logger.info('⏰ Initializing scheduled jobs...');

  // Calculate metrics: Daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('📊 Running scheduled metrics calculation...');
    await calculateMetricsJob();
  }, {
    timezone: 'America/Costa_Rica'
  });

  // Cleanup expired rides: Every 30 minutes (cancels rides 1+ hour past start time)
  cron.schedule('*/30 * * * *', async () => {
    logger.info('🧹 Running scheduled cleanup...');
    await cleanupExpiredRidesJob();
  }, {
    timezone: 'America/Costa_Rica'
  });

  // Send ride reminders: Every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    logger.info('⏰ Running scheduled reminders check...');
    await sendRideRemindersJob();
  }, {
    timezone: 'America/Costa_Rica'
  });
  // [SAFESCORE-AGENT] — Cron jobs del agente (solo si está habilitado)
  if (safescoreCron) {
    cron.schedule('*/15 * * * *', safescoreCron.publishBlindReviewsJob, { timezone: 'America/Costa_Rica' });
    cron.schedule('0 3 * * *',    safescoreCron.antifraudNightlyJob,    { timezone: 'America/Costa_Rica' });
    cron.schedule('0 4 * * *',    safescoreCron.awardBadgesJob,         { timezone: 'America/Costa_Rica' });
    cron.schedule('0 0 1 * *',    safescoreCron.digestMonthlyJob,       { timezone: 'America/Costa_Rica' });
    logger.info('   - [SAFESCORE] publish-blind-reviews: Every 15 min');
    logger.info('   - [SAFESCORE] antifraud-nightly: Daily at 3:00 AM');
    logger.info('   - [SAFESCORE] award-badges: Daily at 4:00 AM');
    logger.info('   - [SAFESCORE] digest-monthly: First day of month');
  }
  // [SAFESCORE-AGENT] — fin

  // Log active jobs
  logger.success('✅ Scheduled jobs initialized successfully');
  logger.info('📋 Active jobs:');
  logger.info('   - Metrics calculation: Daily at 2:00 AM');
  logger.info('   - Cleanup expired rides: Every 30 min (cancels if 1h+ past start)');
  logger.info('   - Send ride reminders: Every 6 hours');
};

/**
 * Run job manually (useful for testing)
 */
const runJobManually = async (jobName) => {
  logger.info(`🔧 Manually running job: ${jobName}`);
  
  switch (jobName) {
    case 'metrics':
      return await calculateMetricsJob();
    case 'cleanup':
      return await cleanupExpiredRidesJob();
    case 'reminders':
      return await sendRideRemindersJob();
    default:
      throw new Error(`Unknown job: ${jobName}`);
  }
};

module.exports = {
  initScheduledJobs,
  runJobManually,
};