module.exports = {
  User: require('./User'),
  Vehicle: require('./Vehicle'),
  Ride: require('./Ride'),
  // Files in this repo use plural or slightly different spellings:
  // - Bookings.js exports the Booking model
  // - Metics.js (typo) exports the Metrics model
  Booking: require('./Bookings'),
  Notification: require('./Notification'),
  Review: require('./Review'),
  Metrics: require('./Metics'),
  VerificationCode: require('./VerificationCode'),
  TrustHistory: require('./TrustHistory'),
};