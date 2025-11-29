const { Ride, Booking, User } = require('../models');
const { success } = require('../utils/logger');
const tz = require('../utils/timeZone');

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

    
    // Parse and validate date_time using configured timezone, store in UTC
    const requested = tz.parseIsoToZone(date_time);
    if (!requested || !requested.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date_time. Send a valid ISO datetime or set APP_TIMEZONE.',
      });
    }
    // Ensure date_time is in the future according to configured timezone
    const now = tz.now();
    if (requested < now) {
      return res.status(400).json({
        success: false,
        message: `date_time must be in the future according to timezone ${tz.zoneName()}`,
      });
    }
    // Convert to UTC for storage
    const requestedUtcDate = tz.toJSDate(tz.toUTC(requested));

    // Create ride
    const ride = await Ride.create({
      driver_id: req.user._id,
      origin,
      destination,
      date_time: requestedUtcDate,
      available_seats,
      distance_km,
      duration_minutes,
    });
    // Populate driver details
    await ride.populate('driver_id', 'name username rating profileImage');
    // Respond successfully
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

//Function to get all rides
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
/*     if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      query.date_time = { $gte: startDate, $lte: endDate };
    } */
    // Filter by date using timezone-aware method
    if (date) {
      const startLocal = tz.parseIsoToZone(`${date}T00:00:00`);
      const endLocal = tz.parseIsoToZone(`${date}T23:59:59.999`);
      if (startLocal && startLocal.isValid && endLocal && endLocal.isValid){
        const startUtc = tz.toJSDate(tz.toUTC(startLocal));
        const endUtc = tz.toJSDate(tz.toUTC(endLocal));
        query.date_time = { $gte: startUtc, $lte: endUtc };
      }
    }

    // Filter by minimum available seats
    if (minSeats) {
      query.available_seats = { $gte: parseInt(minSeats) };
    }
    // Fetch rides with pagination
    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date_time: 1 });
    // Get total count for pagination
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

//Function to get ride by ID
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
      // Validate ride existence
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }
    // Respond successfully
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

//Function to update ride
exports.updateRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);
    // Validate ride existence
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
    // Process updates
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
        if (field === 'date_time') {
          const parsed = tz.parseIsoToZone(req.body[field]);
          if (!parsed || !parsed.isValid) {
            res.status(400).json({
              success: false,
              message: 'Invalid date_time'
            });
          }
          updates[field] = tz.toJSDate(tz.toUTC(parsed));
        } else {
          updates[field] = req.body[field];
        }
      }
    });
    // Apply updates to ride
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

//Function to cancel ride
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
    // Can only cancel if ride is still scheduled
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

//Function to get rides by driver
exports.getRidesByDriver = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { driver_id: req.params.driverId };
    // Optional status filter
    if (status) query.status = status;
    // Fetch rides with pagination
    const rides = await Ride.find(query)
      .populate('driver_id', 'name username rating')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date_time: -1 });
    // Get total count for pagination
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

//Function to start ride
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
    // Can only start if ride is scheduled
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Ride cannot be started',
      });
    }
    // Update status to in_progress
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

//Function to complete ride
exports.completeRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.id);

    // Validate ride existence
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

    // Can only complete if ride is in progress
    if (ride.status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        message: 'Ride is not in progress',
      });
    }

    // Update status to completed
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