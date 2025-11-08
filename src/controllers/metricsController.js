const { Metrics, Ride, Booking } = require('../models');

// Constants for carbon footprint calculation
const AVG_CAR_EMISSION = 0.12; // kg CO2 per km for average car
const AVG_CARPOOLING_FACTOR = 0.6; // 60% reduction with carpooling

// @desc    Get user metrics
// @route   GET /api/v1/metrics/user/:userId
// @access  Private
exports.getUserMetrics = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { period = 'total' } = req.query;

    // Check access
    if (
      userId !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const metrics = await Metrics.findOne({
      user_id: userId,
      period,
    });

    if (!metrics) {
      return res.status(404).json({
        success: false,
        message: 'Metrics not found',
        data: {
          kilometers_driven: 0,
          carbon_footprint: 0,
          total_rides: 0,
          total_passengers: 0,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate and update metrics for a user
// @route   POST /api/v1/metrics/calculate/:userId
// @access  Private/Admin
exports.calculateMetrics = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { period = 'total' } = req.body;

    // Get completed rides as driver
    const completedRides = await Ride.find({
      driver_id: userId,
      status: 'completed',
    });

    // Calculate total kilometers
    const kilometers_driven = completedRides.reduce(
      (sum, ride) => sum + (ride.distance_km || 0),
      0
    );

    // Calculate total passengers across all rides
    const total_passengers = await Booking.countDocuments({
      ride_id: { $in: completedRides.map(r => r._id) },
      status: 'completed',
    });

    // Calculate carbon footprint saved
    const carbon_footprint = kilometers_driven * AVG_CAR_EMISSION * AVG_CARPOOLING_FACTOR * total_passengers;

    // Update or create metrics
    const metrics = await Metrics.findOneAndUpdate(
      { user_id: userId, period },
      {
        kilometers_driven,
        carbon_footprint,
        total_rides: completedRides.length,
        total_passengers,
        date: new Date(),
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Metrics calculated successfully',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global metrics (Admin only)
// @route   GET /api/v1/metrics/global
// @access  Private/Admin
exports.getGlobalMetrics = async (req, res, next) => {
  try {
    const totalMetrics = await Metrics.aggregate([
      { $match: { period: 'total' } },
      {
        $group: {
          _id: null,
          totalKilometers: { $sum: '$kilometers_driven' },
          totalCarbonSaved: { $sum: '$carbon_footprint' },
          totalRides: { $sum: '$total_rides' },
          totalPassengers: { $sum: '$total_passengers' },
        },
      },
    ]);

    const totalUsers = await require('../models').User.countDocuments({ isActive: true });
    const totalDrivers = await require('../models').User.countDocuments({
      type: 'conductor',
      isActive: true,
    });

    res.status(200).json({
      success: true,
      data: {
        ...totalMetrics[0],
        totalUsers,
        totalDrivers,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard (top contributors)
// @route   GET /api/v1/metrics/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 10, sortBy = 'carbon_footprint' } = req.query;

    const leaderboard = await Metrics.find({ period: 'total' })
      .populate('user_id', 'name username profileImage rating')
      .sort({ [sortBy]: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      data: leaderboard,
    });
  } catch (error) {
    next(error);
  }
};