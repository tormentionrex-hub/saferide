const https = require('https');
const { Notification, User } = require('../models');

const sendExpoPush = (expoPushToken, title, body, data = {}) => {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) return Promise.resolve();

  const payload = JSON.stringify({ to: expoPushToken, sound: 'default', title, body, data });

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    }, (res) => { res.resume(); res.on('end', resolve); });

    req.on('error', (err) => { console.error('[Push]', err.message); resolve(); });
    req.write(payload);
    req.end();
  });
};

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

    // Push del SO: solo si el usuario tiene token Y tiene optIn=true.
    // Si optIn=false, el registro queda guardado (la campana lo verá) pero
    // NO se dispara el push externo. El token se preserva igualmente para
    // que reactivar el switch no exija volver a pedir permisos al SO.
    const user = await User.findById(userId).select('+expoPushToken optIn');
    const pushAllowed = user?.optIn !== false; // default true si el campo es undefined (legacy)
    if (user?.expoPushToken && pushAllowed) {
      await sendExpoPush(
        user.expoPushToken,
        'SafeRide',
        message,
        { type, notificationId: notification._id.toString() }
      );
    }

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

    // Enviar push solo a los usuarios con token Y optIn=true
    const users = await User.find({ _id: { $in: userIds } }).select('+expoPushToken optIn');
    await Promise.all(
      users
        .filter(u => u.expoPushToken && u.optIn !== false)
        .map(u => sendExpoPush(u.expoPushToken, 'SafeRide', message, { type }))
    );

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

    const message = `Reminder: Your ride is scheduled for ${ride.fecha} at ${ride.hora}`;

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