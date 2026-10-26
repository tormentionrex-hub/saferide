const { Ride, Booking } = require('../models');
const logger = require('../utils/logger');
const tz = require('../utils/timeZone');
// Job to clean up expired rides and bookings
const cleanupExpiredRidesJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting cleanup of expired rides job...');
    // Current date and time
    try {
        const nowLuxon = tz.now();

        // Solo cancelar viajes que llevan más de 1 hora sin iniciarse (caso extremo)
        const oneHourAgo = nowLuxon.minus({ hours: 1 });
        const cutoffDate = oneHourAgo.toFormat('yyyy-MM-dd');
        const cutoffTime = oneHourAgo.toFormat('HH:mm');

        // Cancel scheduled rides that are more than 1 hour past their start time
        const expiredScheduled = await Ride.updateMany(
            {
                status: 'scheduled',
                $or: [
                    { fecha: { $lt: cutoffDate } },
                    { fecha: cutoffDate, hora: { $lte: cutoffTime } }
                ]
            },
            {
                $set: { status: 'cancelled' },
            }
        );

        // Cutoff date: bookings older than 7 days
        const bookingCutoffDate = new Date();
        bookingCutoffDate.setDate(bookingCutoffDate.getDate() - 7);

        // Cancel old pending bookings
        const expiredBookings = await Booking.updateMany(
            {
                status: 'pending',
                createdAt: { $lt: bookingCutoffDate },
            },
            {
                $set: { status: 'cancelled' },
            }
        );
        // Log job duration and summary
        const duration = ((Date.now() - startTime) /1000).toFixed(2);
        logger.success(`✅ Cleanup completed in ${duration} seconds. Rides updated: ${expiredScheduled.modifiedCount}, Bookings cancelled: ${expiredBookings.modifiedCount}`);
        // Return summary
        return {
            success: true,
            ridesUpdated: expiredScheduled.modifiedCount,
            bookingsUpdated: expiredBookings.modifiedCount,
        };
    } catch (error) {
        logger.error('❌ Error during cleanup of expired rides job:', error);
        return { success: false, error: error.message };
    }
};

module.exports = cleanupExpiredRidesJob;