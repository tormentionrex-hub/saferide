const { Ride, Booking, User } = require('../models');

// @desc    Create a new ride
// @route   POST /api/v1/rides
// @access  Private/Conductor
exports.createRide = async (req, res, next) => {
  try {
    const { origin, destination, date_time, available_seats, distance_km, duration_minutes } = req.body;

    // Check if user is conductor
    if (req.user.type !== 'conductor') {
      return res.status(403).json({
        success: false,
        message: 'Only conductors can create rides',
      });
    }

    // Create ride
    const ride = await Ride.create({
      driver_id: req.user._id,
      origin,
      destination,
      date_time: new Date(date_time),
      available_seats,
      distance_km,
      duration_minutes,
    });

    await ride.populate('driver_id', 'name username rating profileImage');

    res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all rides with filters
// @route   GET /api/v1/rides
// @access  Public
exports.getAllRides = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      origin,
      destination,
      date,
      minSeats,
      status = 'scheduled',
    } = req.query;

    const query = { status };

    // Filter by origin (approximate location)
    if (origin) {
      const [lat, lng] = origin.split(',').map(Number);
      query['origin.coordinates.lat'] = { $gte: lat - 0.05, $lte: lat + 0.05 };
      query['origin.coordinates.lng'] = { $gte: lng - 0.05, $lte: lng + 0.05 };
    }

    // Filter by destination (approximate location)
    if (destination) {
      const [lat, lng] = destination.split(',').map(Number);
      query['destination.coordinates.lat'] = { $gte: lat - 0.05, $lte: lat + 0.05 };
      query['destination.coordinates.lng'] = { $gte: lng - 0.05, $lte: lng + 0.05 };
    }

    // Filter by date
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.date_time = { $gte: startDate, $lte: endDate };
    }

    // Filter by minimum available seats
    if (minSeats) {
      query.available_seats = { $gte: parseInt(minSeats) };
    }

    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date_time: 1 });

    const count = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rides,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get ride by ID
// @route   GET /api/v1/rides/:id
// @access  Public
exports.getRideById = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id)
      .populate('driver_id', 'name username rating profileImage phone')
      .populate({
        path: 'bookings',
        populate: {
          path: 'passenger_id',
          select: 'name username rating profileImage',
        },
      });

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    res.status(200).json({
      success: true,
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update ride
// @route   PUT /api/v1/rides/:id
// @access  Private/Conductor
exports.updateRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Can only update if ride is still scheduled
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update ride that is not scheduled',
      });
    }

    // Fields that can be updated
    const allowedUpdates = ['date_time', 'available_seats', 'status'];
    const updates = {};

    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    Object.assign(ride, updates);
    await ride.save();

    res.status(200).json({
      success: true,
      message: 'Ride updated successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel ride
// @route   DELETE /api/v1/rides/:id
// @access  Private/Conductor
exports.cancelRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride or is admin
    if (
      ride.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    ride.status = 'cancelled';
    await ride.save();

    // TODO: Send notifications to all passengers with bookings

    res.status(200).json({
      success: true,
      message: 'Ride cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get rides by driver
// @route   GET /api/v1/rides/driver/:driverId
// @access  Private
exports.getRidesByDriver = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { driver_id: req.params.driverId };

    if (status) query.status = status;

    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date_time: -1 });

    const count = await Ride.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rides,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Start ride
// @route   PATCH /api/v1/rides/:id/start
// @access  Private/Conductor
exports.startRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Ride cannot be started',
      });
    }

    ride.status = 'in_progress';
    await ride.save();

    res.status(200).json({
      success: true,
      message: 'Ride started successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Complete ride
// @route   PATCH /api/v1/rides/:id/complete
// @access  Private/Conductor
exports.completeRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user owns the ride
    if (ride.driver_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    if (ride.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride is not in progress',
      });
    }

    ride.status = 'completed';
    await ride.save();

    // Update bookings status
    await Booking.updateMany(
      { ride_id: ride._id, status: 'confirmed' },
      { status: 'completed' }
    );

    // TODO: Update metrics and send notifications

    res.status(200).json({
      success: true,
      message: 'Ride completed successfully',
      data: ride,
    });
  } catch (error) {
    next(error);
  }
};