const { Ride, Booking } = require('../models');
const logger = require('../utils/logger');
// Job to clean up expired rides and bookings
const cleanupExpiredRidesJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting cleanup of expired rides job...');
    // Current date and time
    try {
        const now = new Date();

        // Cancel scheduled rides that have already passed
        const expiredScheduled = await Ride.updateMany(
            {
                status: 'scheduled',
                date_time: { $lt: now },
            },
            {
                $set: { status: 'canceled' },
            }
        );

        // Cutoff date: rides older than 7 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 7);

        // Cancel old pending bookings
        const expiredBookings = await Booking.updateMany(
            {
                status: 'pending',
                createdAt: { $lt: cutoffDate },
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