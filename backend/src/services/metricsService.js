const { Ride, Booking } = require('../models');
const { processDriver, processPassenger } = require('../jobs/calculateMetrics');
const logger = require('../utils/logger');

// All refresh helpers swallow errors and log them, so callers can fire-and-forget
// without metric failures breaking the request that triggered them.

// Refresh both the driver's and every involved passenger's metrics for a completed ride.
const refreshMetricsForRide = async (rideId) => {
    try {
        const ride = await Ride.findById(rideId, { driver_id: 1 });
        if (!ride) return;

        const completedBookings = await Booking.find(
            { ride_id: rideId, status: 'completed' },
            { passenger_id: 1 }
        );

        const passengerIds = [...new Set(completedBookings.map((b) => b.passenger_id.toString()))];

        await Promise.allSettled([
            processDriver({ _id: ride.driver_id }),
            ...passengerIds.map((pid) => processPassenger({ _id: pid })),
        ]);
    } catch (error) {
        logger.error(`❌ refreshMetricsForRide failed for ride ${rideId}:`, error.message);
    }
};

// Refresh metrics for a single booking transition (passenger + driver of that booking's ride).
const refreshMetricsForBooking = async (booking) => {
    try {
        const rideId = booking.ride_id?._id || booking.ride_id;
        const ride = await Ride.findById(rideId, { driver_id: 1 });
        if (!ride) return;

        await Promise.allSettled([
            processPassenger({ _id: booking.passenger_id }),
            processDriver({ _id: ride.driver_id }),
        ]);
    } catch (error) {
        logger.error(`❌ refreshMetricsForBooking failed for booking ${booking?._id}:`, error.message);
    }
};

module.exports = {
    refreshMetricsForRide,
    refreshMetricsForBooking,
};
