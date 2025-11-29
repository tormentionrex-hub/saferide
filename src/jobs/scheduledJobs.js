const cron = require('node-cron');
const logger = require('../utils/logger');
const calculateMetricsJob = require('./calculateMetrics');
const cleanupExpiredRidesJob = require('./cleanupExpiredRides');
const sendRideRemindersJob = require('./sendRideReminders');

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

  // Cleanup expired rides: Daily at midnight
  cron.schedule('0 0 * * *', async () => {
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
  // Log active jobs
  logger.success('✅ Scheduled jobs initialized successfully');
  logger.info('📋 Active jobs:');
  logger.info('   - Metrics calculation: Daily at 2:00 AM');
  logger.info('   - Cleanup expired rides: Daily at midnight');
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