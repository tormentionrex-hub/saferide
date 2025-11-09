const { User, Ride, Booking, Metrics } = require('../models');
const logger = require('../utils/logger');

const AVG_CAR_EMISSION = 0.12; // kg CO2 per km
const AVG_CARPOOLING_FACTOR = 0.6; // 60% reduction

const calculateCarbonSaved = (kilometers, passengers) => {
    return kilometers * AVG_CAR_EMISSION * AVG_CARPOOLING_FACTOR * passengers;
};

const calculateMetricsJob = async () => {
    const startTime = Date.now();
    logger.info('🚀 Starting metrics calculation job...');
    try {
        const drivers = await User.find({ type: 'conductor', isActive: true});

        let totalProcessed = 0;
        let totalErrors = 0;

        for (const driver of drivers) {
            try {
                // Obtener viajes completados
                const completedRides = await Ride.find({
                    driver_id: driver._id,
                    status: 'completed',
                });

                if (completedRides.length === 0) {
                    continue;
                }

                // Calcular kilometros
                const kilometers_driven = completedRides.reduce((sum, ride) => sum + (ride.distance_km || 0), 0);

                // Contar pasajeros
                const total_passengers = await Booking.countDocuments({
                    ride_id: { $in: completedRides.map(r => r._id) },
                    status: 'completed',
                });

                // Calcular huella de carbono
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

                totalProcessed++;

            } catch (error) {
                totalErrors++;
                logger.error(`❌ Error processing driver ${driver._id}:`, error.message);
            }
            
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logger.success(`✅ Metrics calculation job completed in ${duration} seconds. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
        return { success: true, processed: totalProcessed, errors: totalErrors};
    } catch (error) {
        logger.error('❌ Error in metrics calculation job:', error);
        return { success: false, error: error.message};
    }
};

module.exports = calculateMetricsJob;