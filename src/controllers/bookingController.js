const { Booking, Ride, Notification } = require('../models');
const { sendNotification } = require('../workers/notificationWorker');

// @desc    Create a booking
// @route   POST /api/v1/bookings
// @access  Private/Pasajero

//Function to create a booking
exports.createBooking = async (req, res, next) => {
  try {
    const { ride_id, seats_booked = 1 } = req.body;

    // Find the ride
    const ride = await Ride.findById(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
      }

    // Check if ride is available for booking
    if (ride.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        message: 'This ride is not available for booking',
      });
    }

    // Check if user is trying to book their own ride
    if (ride.driver_id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot book your own ride',
      });
    }

    // Check if user already has a booking for this ride
    const existingBooking = await Booking.findOne({
      ride_id,
      passenger_id: req.user._id,
      status: { $in: ['pending', 'confirmed'] },
    });

    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: 'You already have a booking for this ride',
      });
    }

    // Check if enough seats are available
    if (ride.available_seats < seats_booked) {
      return res.status(400).json({
        success: false,
        message: `Only ${ride.available_seats} seat(s) available`,
      });
    }

    // Create booking
    const booking = await Booking.create({
      ride_id,
      passenger_id: req.user._id,
      seats_booked,
      status: 'confirmed', // Auto-confirm for now
    });

    // Update available seats in ride
    ride.available_seats -= seats_booked;
    await ride.save();

    // Create notification for driver
    await Notification.create({
      user_id: ride.driver_id,
      message: `${req.user.name} has booked ${seats_booked} seat(s) in your ride`,
      type: 'booking_confirmed',
      relatedEntity: {
        entityType: 'booking',
        entityId: booking._id,
      },
    });

    sendNotification(
      ride.driver_id.toString(),
      `${req.user.name} ha reservado ${seats_booked} asiento(s) en tu viaje`,
      'booking_confirmed',
      {
        entityType: 'booking',
        entityId: booking._id,
      }
    );

    await booking.populate('ride_id passenger_id');

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all bookings (Admin or filtered by user)
// @route   GET /api/v1/bookings
// @access  Private

//Function to get all bookings
exports.getAllBookings = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, userId } = req.query;
    const query = {};

    if (status) query.status = status;

    // If not admin, only show user's own bookings
    if (req.user.type !== 'administrador') {
      query.passenger_id = req.user._id;
    } else if (userId) {
      query.passenger_id = userId;
    }
    // Fetch bookings with pagination
    const bookings = await Booking.find(query)
      .populate('ride_id')
      .populate('passenger_id', 'name username rating profileImage')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const count = await Booking.countDocuments(query);
    // Return paginated results
    res.status(200).json({
      success: true,
      data: bookings,
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

// @desc    Get booking by ID
// @route   GET /api/v1/bookings/:id
// @access  Private

//Function to get booking by ID
exports.getBookingById = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'ride_id',
        populate: {
          path: 'driver_id',
          select: 'name username rating profileImage phone',
        },
      })
      .populate('passenger_id', 'name username rating profileImage phone');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user has access to this booking
    if (
      booking.passenger_id._id.toString() !== req.user._id.toString() &&
      booking.ride_id.driver_id._id.toString() !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Return booking details
    res.status(200).json({
      success: true,
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get bookings by passenger
// @route   GET /api/v1/bookings/passenger/:passengerId
// @access  Private

//Function to get bookings by passenger
exports.getBookingsByPassenger = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const passengerId = req.params.passengerId;

    // Check if user has access
    if (
      passengerId !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Build query
    const query = { passenger_id: passengerId };
    if (status) query.status = status;
    // Fetch bookings with pagination
    const bookings = await Booking.find(query)
      .populate({
        path: 'ride_id',
        populate: {
          path: 'driver_id',
          select: 'name username rating profileImage',
        },
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
      // Return paginated results
    const count = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
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

// @desc    Get bookings by ride
// @route   GET /api/v1/bookings/ride/:rideId
// @access  Private

//Function to get bookings by ride
exports.getBookingsByRide = async (req, res, next) => {
  try {
    const ride = await Ride.findById(req.params.rideId);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    // Check if user is the driver
    if (
      ride.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Fetch bookings for the ride
    const bookings = await Booking.find({ ride_id: req.params.rideId })
      .populate('passenger_id', 'name username rating profileImage phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: bookings,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel booking
// @route   DELETE /api/v1/bookings/:id
// @access  Private

//Function to cancel a booking
exports.cancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user owns the booking
    if (booking.passenger_id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This booking cannot be cancelled',
      });
    }

    // Update booking status
    booking.status = 'cancelled';
    await booking.save();

    // Return seats to ride
    const ride = booking.ride_id;
    ride.available_seats += booking.seats_booked;
    await ride.save();

    // Create notification for driver
    await Notification.create({
      user_id: ride.driver_id,
      message: `${req.user.name} has cancelled their booking`,
      type: 'booking_cancelled',
      relatedEntity: {
        entityType: 'booking',
        entityId: booking._id,
      },
    });

    sendNotification(
      ride.driver_id.toString(),
      `${req.user.name} ha cancelado su reserva`,
      'booking_cancelled',
      {
        entityType: 'booking',
        entityId: booking._id,
      }
    );

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update booking status (Admin/Driver only)
// @route   PATCH /api/v1/bookings/:id/status
// @access  Private

//Function to update booking status
exports.updateBookingStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const booking = await Booking.findById(req.params.id).populate('ride_id');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found',
      });
    }

    // Check if user is driver or admin
    if (
      booking.ride_id.driver_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Update status
    booking.status = status;
    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Booking status updated successfully',
      data: booking,
    });
  } catch (error) {
    next(error);
  }
};