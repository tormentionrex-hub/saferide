const { Metrics, Ride, Booking, User } = require('../models');
const { processDriver, processPassenger } = require('../jobs/calculateMetrics');

// @desc    Get user metrics
// @route   GET /api/v1/metrics/user/:userId?role=conductor|pasajero&period=total
// @access  Private

const VALID_ROLES = ['conductor', 'pasajero'];

// Map User.type values to a metrics role; admins default to 'conductor' when no param is provided
const inferRoleFromUserType = (userType) => {
  if (userType === 'conductor') return 'conductor';
  if (userType === 'pasajero') return 'pasajero';
  return 'conductor';
};

exports.getUserMetrics = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const { period = 'total', role: roleParam } = req.query;

    // Authorization: own metrics or admin
    if (
      userId !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Resolve role: explicit query param wins (a driver can request their passenger view).
    // Fall back to deducing from the authenticated user's type only when not provided.
    let role;
    if (roleParam !== undefined) {
      if (!VALID_ROLES.includes(roleParam)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}`,
        });
      }
      role = roleParam;
    } else {
      role = inferRoleFromUserType(req.user.type);
    }

    const metrics = await Metrics.findOne({
      user_id: userId,
      role,
      period,
    });

    // No 404: return zeros so the frontend can render an empty state uniformly
    if (!metrics) {
      return res.status(200).json({
        success: true,
        data: {
          user_id: userId,
          role,
          period,
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

// @desc    Recalculate metrics for a user (admin trigger)
// @route   POST /api/v1/metrics/calculate/:userId
// @body    { role?: 'conductor' | 'pasajero' }   default: 'conductor'
// @access  Private/Admin
exports.calculateMetrics = async (req, res, next) => {
  try {
    const userId = req.params.userId;
    const role = req.body.role || 'conductor';

    if (!['conductor', 'pasajero'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: conductor, pasajero`,
      });
    }

    // Reuse the same logic as the cron job so both stay in sync
    const outcome = role === 'conductor'
      ? await processDriver({ _id: userId })
      : await processPassenger({ _id: userId });

    const metrics = await Metrics.findOne({ user_id: userId, role, period: 'total' });

    res.status(200).json({
      success: true,
      message: outcome === 'processed'
        ? 'Metrics recalculated successfully'
        : 'No completed activity found for this user',
      data: metrics,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get passenger metrics
// @route   GET /api/v1/metrics/passenger/:passengerId
// @access  Private
exports.getPassengerMetrics = async (req, res, next) => {
  try {
    const passengerId = req.params.passengerId;

    if (
      passengerId !== req.user._id.toString() &&
      req.user.type !== 'admin'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    const bookings = await Booking.find({
      passenger_id: passengerId,
      status: 'completed',
    })
      .populate({
        path: 'ride_id',
        populate: {
          path: 'driver_id',
          select: 'name username rating profileImage',
        },
      })
      .sort({ updatedAt: -1 });

    const totalKilometers = Number(
      bookings.reduce((sum, booking) => sum + (booking.distance_km || 0), 0).toFixed(1)
    );

    res.status(200).json({
      success: true,
      data: {
        passenger_id: passengerId,
        total_kilometers: totalKilometers,
        total_bookings: bookings.length,
        bookings,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get global metrics (Admin only)
// @route   GET /api/v1/metrics/global
// @access  Private/Admin

//Function to get global metrics
exports.getGlobalMetrics = async (req, res, next) => {
  try {
    // Restricted to driver-side records to avoid double-counting kilometers
    // (each completed booking generates both a driver and a passenger entry).
    const totalMetrics = await Metrics.aggregate([
      { $match: { period: 'total', role: 'conductor' } },
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
    const ahora = new Date();
    const inicioMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1));
    const finMes = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth() + 1, 1));

    const [totalUsers, totalDrivers, totalPassengers, totalAdmins, activeUsers, paymentRows, methodRows, monthlyCarbonRows] = await Promise.all([
      User.countDocuments({ type: { $in: ['conductor', 'pasajero'] } }),
      User.countDocuments({ type: 'conductor' }),
      User.countDocuments({ type: 'pasajero' }),
      User.countDocuments({ type: 'admin' }),
      User.countDocuments({ isActive: true }),
      Booking.aggregate([{ $group: { _id: '$payment_status', count: { $sum: 1 } } }]),
      Booking.aggregate([
        { $group: { _id: { $ifNull: ['$payment_method', 'sin_method'] }, count: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        {
          $match: {
            status: 'completed',
            createdAt: { $gte: inicioMes, $lt: finMes },
          },
        },
        {
          $group: {
            _id: null,
            bookings: { $sum: 1 },
            kilometers: { $sum: { $ifNull: ['$distance_km', 0] } },
          },
        },
      ]),
    ]);

    const monthlyKilometers = Number(monthlyCarbonRows[0]?.kilometers) || 0;
    const monthlyCarbonSaved = Number((monthlyKilometers * 0.072).toFixed(2));

    const payments = { paid: 0, pending: 0, waived: 0, other: 0, total: 0 };
    paymentRows.forEach((row) => {
      payments.total += row.count;
      if (Object.prototype.hasOwnProperty.call(payments, row._id) && row._id !== 'total') {
        payments[row._id] += row.count;
      } else {
        payments.other += row.count;
      }
    });

    const paymentMethods = {};
    methodRows.forEach((row) => { paymentMethods[row._id] = row.count; });

    res.status(200).json({
      success: true,
      data: {
        ...totalMetrics[0],
        totalUsers,
        totalDrivers,
        totalPassengers,
        totalAdmins,
        activeUsers,
        payments,
        paymentMethods,
        monthlyCarbonSaved,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getBookingsByDay = async (req, res, next) => {
  try {
    const days = [7, 14, 21].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
    const dayMs = 24 * 60 * 60 * 1000;
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(today.getTime() - (days - 1) * dayMs);
    const end = new Date(today.getTime() + dayMs);

    const grouped = await Booking.aggregate([
      { $match: { createdAt: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          value: { $sum: 1 },
        },
      },
    ]);

    const counts = new Map(grouped.map((item) => [item._id, item.value]));
    const data = Array.from({ length: days }, (_, i) => {
      const date = new Date(start.getTime() + i * dayMs);
      const key = date.toISOString().slice(0, 10);
      return {
        date: key,
        name: date.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', timeZone: 'UTC' }).replace('.', ''),
        value: counts.get(key) || 0,
      };
    });

    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

// @desc    Get leaderboard (top contributors)
// @route   GET /api/v1/metrics/leaderboard
// @access  Public

//Function to get leaderboard
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 10, sortBy = 'carbon_footprint' } = req.query;
    // Driver-only ranking (original semantics before the role field was introduced).
    // Pass ?role=pasajero in a future iteration if a passenger leaderboard is needed.
    const leaderboard = await Metrics.find({ period: 'total', role: 'conductor' })
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
