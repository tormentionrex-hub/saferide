const mongoose = require('mongoose');
const { User, Ride, Booking, Metrics } = require('../models');
const logger = require('../utils/logger');

// Aggregation $match does not auto-cast string IDs to ObjectId; cast defensively
// so processDriver/processPassenger work with either input shape.
const toObjectId = (id) => (id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(String(id)));

// Constants for carbon footprint calculation
const AVG_CAR_EMISSION = 0.12; // kg CO2 per km
const AVG_CARPOOLING_FACTOR = 0.6; // 60% reduction
const BATCH_SIZE = 50;

// Carbon saved is proportional to total passenger-kilometers carpooled
// (one car off the road per passenger-trip).
const calculateCarbonSaved = (passengerKilometers) => {
    return passengerKilometers * AVG_CAR_EMISSION * AVG_CARPOOLING_FACTOR;
};

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

// Process an array of items in batches with Promise.allSettled, so a single failure
// doesn't abort the rest of the batch.
const runInBatches = async (items, worker) => {
    const results = { processed: 0, errors: 0 };
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const slice = items.slice(i, i + BATCH_SIZE);
        const settled = await Promise.allSettled(slice.map(worker));
        for (const r of settled) {
            if (r.status === 'fulfilled' && r.value === 'processed') results.processed++;
            else if (r.status === 'rejected') results.errors++;
        }
    }
    return results;
};

// Recalculate and upsert driver-side metrics for a single user.
const processDriver = async (driver) => {
    const driverId = toObjectId(driver._id);
    const completedRides = await Ride.find({
        driver_id: driverId,
        status: 'completed',
    }, { _id: 1, distance_km: 1 });

    if (completedRides.length === 0) return 'skipped';

    const rideIds = completedRides.map((r) => r._id);

    const [bookingTotals] = await Booking.aggregate([
        {
            $match: {
                ride_id: { $in: rideIds },
                status: 'completed',
            },
        },
        {
            $group: {
                _id: null,
                passenger_kilometers: { $sum: { $ifNull: ['$distance_km', 0] } },
                total_passengers: { $sum: 1 },
                ridesWithPassengers: { $addToSet: '$ride_id' },
            },
        },
    ]);

    if (!bookingTotals || bookingTotals.total_passengers === 0) return 'skipped';

    const ridesWithPassengersSet = new Set(
        bookingTotals.ridesWithPassengers.map((id) => id.toString())
    );

    // Vehicle km: only count rides that actually carried passengers (skip no-show / empty rides)
    const kilometers_driven = completedRides
        .filter((r) => ridesWithPassengersSet.has(r._id.toString()))
        .reduce((sum, r) => sum + (r.distance_km || 0), 0);

    const passenger_kilometers = bookingTotals.passenger_kilometers;
    const total_passengers = bookingTotals.total_passengers;
    const total_rides = ridesWithPassengersSet.size;
    const carbon_footprint = calculateCarbonSaved(passenger_kilometers);

    await Metrics.findOneAndUpdate(
        { user_id: driverId, role: 'conductor', period: 'total' },
        {
            role: 'conductor',
            kilometers_driven: round1(kilometers_driven),
            passenger_kilometers: round1(passenger_kilometers),
            carbon_footprint: round2(carbon_footprint),
            total_rides,
            total_passengers,
            date: new Date(),
        },
        { upsert: true, new: true }
    );

    return 'processed';
};

// Recalculate and upsert passenger-side metrics for a single user.
const processPassenger = async (user) => {
    const userId = toObjectId(user._id);
    const [totals] = await Booking.aggregate([
        {
            $match: {
                passenger_id: userId,
                status: 'completed',
            },
        },
        {
            $group: {
                _id: null,
                kilometers_driven: { $sum: { $ifNull: ['$distance_km', 0] } },
                total_rides: { $sum: 1 },
            },
        },
    ]);

    const total_rides = totals?.total_rides || 0;
    if (total_rides === 0) return 'skipped';

    const kilometers_driven = totals?.kilometers_driven || 0;
    const carbon_footprint = calculateCarbonSaved(kilometers_driven);

    await Metrics.findOneAndUpdate(
        { user_id: userId, role: 'pasajero', period: 'total' },
        {
            role: 'pasajero',
            kilometers_driven: round1(kilometers_driven),
            passenger_kilometers: 0,
            carbon_footprint: round2(carbon_footprint),
            total_rides,
            total_passengers: 0,
            date: new Date(),
        },
        { upsert: true, new: true }
    );

    return 'processed';
};

// Bulk: recalculate driver metrics for all active conductors.
const calculateDriverMetrics = async () => {
    const drivers = await User.find({ type: 'conductor', isActive: true }, { _id: 1 });
    return runInBatches(drivers, async (driver) => {
        try {
            return await processDriver(driver);
        } catch (error) {
            logger.error(`❌ Error processing driver ${driver._id}:`, error.message);
            throw error;
        }
    });
};

// Bulk: recalculate passenger metrics for all active users (drivers can also be passengers).
const calculatePassengerMetrics = async () => {
    const users = await User.find({ isActive: true }, { _id: 1 });
    return runInBatches(users, async (user) => {
        try {
            return await processPassenger(user);
        } catch (error) {
            logger.error(`❌ Error processing passenger ${user._id}:`, error.message);
            throw error;
        }
    });
};

const calculateMetricsJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting metrics calculation job...');

    try {
        const driverResult = await calculateDriverMetrics();
        const passengerResult = await calculatePassengerMetrics();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success(
            `✅ Metrics job completed in ${duration}s. ` +
            `Drivers — processed: ${driverResult.processed}, errors: ${driverResult.errors}. ` +
            `Passengers — processed: ${passengerResult.processed}, errors: ${passengerResult.errors}.`
        );

        return {
            success: true,
            drivers: driverResult,
            passengers: passengerResult,
        };
    } catch (error) {
        logger.error('❌ Error in metrics calculation job:', error);
        return { success: false, error: error.message };
    }
};

module.exports = calculateMetricsJob;
module.exports.processDriver = processDriver;
module.exports.processPassenger = processPassenger;
module.exports.calculateDriverMetrics = calculateDriverMetrics;
module.exports.calculatePassengerMetrics = calculatePassengerMetrics;
