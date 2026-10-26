const { Ride, Booking } = require('../models');
const { sendBulkNotifications } = require('../workers/notificationWorker');
const logger = require('../utils/logger');
const tz = require('../utils/timeZone');

// Job to send ride reminders
const sendRideRemindersJob = async () => {
  const startTime = Date.now();
  logger.info('⏰ Checking for ride reminders...');
  // Current date and time
  try {
    const nowLuxon = tz.now();
    const nowDate = nowLuxon.toFormat('yyyy-MM-dd');

    // Find upcoming rides for today
    const upcomingRidesFull = await Ride.find({
      status: 'scheduled',
      fecha: nowDate
    });

    const upcomingRides = upcomingRidesFull.filter(ride => {
      const [h, mm] = ride.hora.split(':').map(Number);
      const rideTime = nowLuxon.set({ hour: h, minute: mm, second: 0, millisecond: 0 });
      const diffHrs = rideTime.diff(nowLuxon, 'hours').hours;
      return diffHrs >= 2 && diffHrs <= 4;
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
          date: { $gte: nowLuxon.minus({ days: 1 }).toJSDate() },
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
        const [h_sub, mm_sub] = ride.hora.split(':').map(Number);
        const rideTimeStrObj = nowLuxon.set({ hour: h_sub, minute: mm_sub });
        const hoursUntilRide = Math.round(rideTimeStrObj.diff(nowLuxon, 'hours').hours);

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