const { Metrics, Ride, Booking } = require('../models');

const AVG_CAR_EMISSION = 0.12; // kg CO2 per km
const AVG_CARPOOLING_FACTOR = 0.6; // 60% reduction

/**
 * Calculate carbon footprint saved
 * @param {number} kilometers - Distance in km
 * @param {number} passengers - Number of passengers
 * @returns {number}
 */
const calculateCarbonSaved = (kilometers, passengers) => {
  return kilometers * AVG_CAR_EMISSION * AVG_CARPOOLING_FACTOR * passengers;
};

/**
 * Update user metrics after ride completion
 * @param {string} userId - User ID
 * @param {Object} rideData - Ride data
 * @returns {Promise<Object>}
 */
const updateUserMetrics = async (userId, rideData) => {
  try {
    const { distance_km, passengerCount } = rideData;

    // Calculate carbon saved
    const carbonSaved = calculateCarbonSaved(distance_km, passengerCount);

    // Update total metrics
    let metrics = await Metrics.findOne({
      user_id: userId,
      period: 'total',
    });

    if (!metrics) {
      metrics = new Metrics({
        user_id: userId,
        period: 'total',
      });
    }

    metrics.kilometers_driven += distance_km;
    metrics.carbon_footprint += carbonSaved;
    metrics.total_rides += 1;
    metrics.total_passengers += passengerCount;
    metrics.date = new Date();

    await metrics.save();

    return metrics;
  } catch (error) {
    console.error('Error updating user metrics:', error);
    throw error;
  }
};

/**
 * Calculate metrics for all users (batch job)
 * @returns {Promise<void>}
 */
const calculateAllMetrics = async () => {
  try {
    const { User } = require('../models');
    
    const drivers = await User.find({ type: 'conductor', isActive: true });

    for (const driver of drivers) {
      const completedRides = await Ride.find({
        driver_id: driver._id,
        status: 'completed',
      });

      const kilometers_driven = completedRides.reduce(
        (sum, ride) => sum + (ride.distance_km || 0),
        0
      );

      const total_passengers = await Booking.countDocuments({
        ride_id: { $in: completedRides.map(r => r._id) },
        status: 'completed',
      });

      const carbon_footprint = calculateCarbonSaved(kilometers_driven, total_passengers);

      await Metrics.findOneAndUpdate(
        { user_id: driver._id, period: 'total' },
        {
          kilometers_driven,
          carbon_footprint,
          total_rides: completedRides.length,
          total_passengers,
          date: new Date(),
        },
        { upsert: true }
      );
    }

    console.log('✅ All metrics calculated successfully');
  } catch (error) {
    console.error('❌ Error calculating metrics:', error);
  }
};

module.exports = {
  calculateCarbonSaved,
  updateUserMetrics,
  calculateAllMetrics,
};