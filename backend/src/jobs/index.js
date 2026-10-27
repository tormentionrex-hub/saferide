module.exports = {
  ...require('./scheduledJobs'),
  calculateMetricsJob: require('./calculateMetrics'),
  cleanupExpiredRidesJob: require('./cleanupExpiredRides'),
  sendRideRemindersJob: require('./sendRideReminders'),
};