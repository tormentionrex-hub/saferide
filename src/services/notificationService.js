const { Notification } = require('../models');

/**
 * Send notification to user
 * @param {string} userId - User ID
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {Object} relatedEntity - Related entity info
 * @returns {Promise<Object>}
 */
const sendNotification = async (userId, message, type, relatedEntity = null) => {
  try {
    const notification = await Notification.create({
      user_id: userId,
      message,
      type,
      relatedEntity,
    });

    // TODO: Integrate with push notification service (Azure Notification Hubs)
    // await sendPushNotification(userId, message);

    return notification;
  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Send bulk notifications
 * @param {Array} userIds - Array of user IDs
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @returns {Promise<Array>}
 */
const sendBulkNotifications = async (userIds, message, type) => {
  try {
    const notifications = userIds.map(userId => ({
      user_id: userId,
      message,
      type,
    }));

    const result = await Notification.insertMany(notifications);

    // TODO: Send push notifications in bulk

    return result;
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    throw error;
  }
};

/**
 * Send ride reminder notifications
 * @param {Object} ride - Ride object
 * @returns {Promise<void>}
 */
const sendRideReminder = async (ride) => {
  try {
    const { Booking } = require('../models');
    
    // Get all passengers with confirmed bookings
    const bookings = await Booking.find({
      ride_id: ride._id,
      status: 'confirmed',
    });

    const passengerIds = bookings.map(b => b.passenger_id);
    const allUserIds = [ride.driver_id, ...passengerIds];

    const message = `Reminder: Your ride is scheduled for ${new Date(ride.date_time).toLocaleString()}`;

    await sendBulkNotifications(allUserIds, message, 'ride_reminder');
  } catch (error) {
    console.error('Error sending ride reminder:', error);
  }
};

module.exports = {
  sendNotification,
  sendBulkNotifications,
  sendRideReminder,
};