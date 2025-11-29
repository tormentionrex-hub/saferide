const { User, Ride, Booking, Metrics } = require('../models');
const logger = require('../utils/logger');
// Constants for carbon footprint calculation
const AVG_CAR_EMISSION = 0.12; // kg CO2 per km
const AVG_CARPOOLING_FACTOR = 0.6; // 60% reduction
// Function to calculate carbon saved
const calculateCarbonSaved = (kilometers, passengers) => {
    return kilometers * AVG_CAR_EMISSION * AVG_CARPOOLING_FACTOR * passengers;
};
// Job to calculate and update metrics for all drivers
const calculateMetricsJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting metrics calculation job...');
    // Fetch all active drivers
    try {
        const drivers = await User.find({ type: 'conductor', isActive: true});
        // Process each driver
        let totalProcessed = 0;
        let totalErrors = 0;
        // Iterate through drivers
        for (const driver of drivers) {
            try {
                // Get completed rides
                const completedRides = await Ride.find({
                    driver_id: driver._id,
                    status: 'completed',
                });
                // If no rides, continue
                if (completedRides.length === 0) {
                    continue;
                }

                // Calculate kilometers driven
                const kilometers_driven = completedRides.reduce((sum, ride) => sum + (ride.distance_km || 0), 0);

                // Count passengers
                const total_passengers = await Booking.countDocuments({
                    ride_id: { $in: completedRides.map(r => r._id) },
                    status: 'completed',
                });

                // Calculate carbon footprint
                const carbon_footprint = calculateCarbonSaved(
                    kilometers_driven,
                    total_passengers,
                );

                // Actualizar o crear metricas
                await Metrics.findOneAndUpdate(
                    { user_id: driver_id, period: 'total' },
                    {
                        kilometers_driven: Math.round(kilometers_driven * 10) / 10,
                        carbon_footprint: Math.round(carbon_footprint * 100) /100,
                        total_rides: completedRides.length,
                        total_passengers,
                        date: new Date(), 
                    }, {
                        upsert: true, new: true,
                    }
                );
                // Increment processed count
                totalProcessed++;

            } catch (error) {
                totalErrors++;
                logger.error(`❌ Error processing driver ${driver._id}:`, error.message);
            }
            
        }
        // Log job duration and summary
        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success(`✅ Metrics calculation job completed in ${duration} seconds. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
        return { success: true, processed: totalProcessed, errors: totalErrors};
    } catch (error) {
        logger.error('❌ Error in metrics calculation job:', error);
        return { success: false, error: error.message};
    }
};

module.exports = calculateMetricsJob;