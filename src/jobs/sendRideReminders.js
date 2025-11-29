const { Ride, Booking } = require('../models');
const { sendBulkNotifications } = require('../workers/notificationWorker');
const logger = require('../utils/logger');

// Job to send ride reminders
const sendRideRemindersJob = async () => {
  const startTime = Date.now();
  logger.info('⏰ Checking for ride reminders...');
  // Current date and time
  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // Find upcoming rides
    const upcomingRides = await Ride.find({
      status: 'scheduled',
      date_time: {
        $gte: twoHoursLater,
        $lte: fourHoursLater,
      },
    });

    let remindersSent = 0;
    // Process each ride
    for (const ride of upcomingRides) {
      try {
        // Verify if the reminder has been sent in the last 24 hours
        const { Notification } = require('../models');
        const recentReminder = await Notification.findOne({
          'relatedEntity.entityId': ride._id,
          type: 'ride_reminder',
          date: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        });

        if (recentReminder) {
          continue;
        }

        // Get passengers
        const bookings = await Booking.find({
          ride_id: ride._id,
          status: 'confirmed',
        });

        const passengerIds = bookings.map(b => b.passenger_id.toString());
        const allUserIds = [ride.driver_id.toString(), ...passengerIds];

        // Calculate hours until the ride
        const hoursUntilRide = Math.round((ride.date_time - now) / (60 * 60 * 1000));

        const message = `Recordatorio: Tu viaje es en ${hoursUntilRide} horas`;

        // Send notifications
        sendBulkNotifications(allUserIds, message, 'ride_reminder');

        remindersSent += allUserIds.length;

      } catch (error) {
        logger.error(`Error processing ride ${ride._id}:`, error);
      }
    }
    // Log job duration and summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.success(
      `✅ Reminders check completed in ${duration}s. Rides checked: ${upcomingRides.length}, Reminders sent: ${remindersSent}`
    );

    return {
      success: true,
      ridesChecked: upcomingRides.length,
      remindersSent,
    };

  } catch (error) {
    logger.error('❌ Error in reminders job:', error);
    return { success: false, error: error.message };
  }
};

module.exports = sendRideRemindersJob;