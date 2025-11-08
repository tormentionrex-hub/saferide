const { Ride, Booking } = require('../models');
const { sendBulkNotifications } = require('../workers/notificationWorker');
const logger = require('../utils/logger');

const sendRideRemindersJob = async () => {
  const startTime = Date.now();
  logger.info('⏰ Checking for ride reminders...');

  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const fourHoursLater = new Date(now.getTime() + 4 * 60 * 60 * 1000);

    // Buscar viajes próximos
    const upcomingRides = await Ride.find({
      status: 'scheduled',
      date_time: {
        $gte: twoHoursLater,
        $lte: fourHoursLater,
      },
    });

    let remindersSent = 0;

    for (const ride of upcomingRides) {
      try {
        // Verificar si ya se envió recordatorio en las últimas 24 horas
        const { Notification } = require('../models');
        const recentReminder = await Notification.findOne({
          'relatedEntity.entityId': ride._id,
          type: 'ride_reminder',
          date: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
        });

        if (recentReminder) {
          continue;
        }

        // Obtener pasajeros
        const bookings = await Booking.find({
          ride_id: ride._id,
          status: 'confirmed',
        });

        const passengerIds = bookings.map(b => b.passenger_id.toString());
        const allUserIds = [ride.driver_id.toString(), ...passengerIds];

        // Calcular horas hasta el viaje
        const hoursUntilRide = Math.round((ride.date_time - now) / (60 * 60 * 1000));

        const message = `Recordatorio: Tu viaje es en ${hoursUntilRide} horas`;

        // Enviar notificaciones
        sendBulkNotifications(allUserIds, message, 'ride_reminder');

        remindersSent += allUserIds.length;

      } catch (error) {
        logger.error(`Error processing ride ${ride._id}:`, error);
      }
    }

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