const monitoringService = require('../services/monitoringService');

exports.getActiveRides = async (req, res, next) => {
  try {
    const rides = await monitoringService.getActiveMonitoringRides();
    res.status(200).json({
      success: true,
      data: rides,
      generatedAt: new Date().toISOString(),
      summary: {
        active: rides.length,
        live: rides.filter((ride) => ride.location?.isLive).length,
        passengers: rides.reduce((sum, ride) => sum + ride.passengerCount, 0),
      },
    });
  } catch (error) {
    next(error);
  }
};
