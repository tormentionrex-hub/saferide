const { Ride, Booking } = require('../models');
const logger = require('../utils/logger');

const cleanupExpiredRidesJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting cleanup of expired rides job...');

    try {
        const now = new Date();

        // Cancelar viajes programados que ya pasaron
        const expiredScheduled = await Ride.updateMany(
            {
                status: 'scheduled',
                date_time: { $lt: now },
            },
            {
                $set: { status: 'canceled' },
            }
        );

        // Fecha limite: viajes de hace mas de 7 dias
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        // Cancelar Bookings pendientes antiguos
        const expiredBookings = await Booking.updateMany(
            {
                status: 'pending',
                createdAt: { $lt: cutoffDate },
            },
            {
                $set: { status: 'cancelled' },
            }
        );

        const duration = ((Date.now() - startTime) /1000).toFixed(2);
        logger.success(`✅ Cleanup completed in ${duration} seconds. Rides updated: ${expiredScheduled.modifiedCount}, Bookings cancelled: ${expiredBookings.modifiedCount}`);

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