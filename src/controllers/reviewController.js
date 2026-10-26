const { Review, Ride, Booking, User } = require('../models');

// @desc    Create a review
// @route   POST /api/v1/reviews
// @access  Private


// Calificación de un usuario = promedio real de sus reseñas, con dos
// decimales. Antes la creación sumaba un 5 inicial a la cuenta
// ((suma + 5) / (n + 1)) y el borrado usaba el promedio real, así que la nota
// cambiaba de método según la última acción. Sin reseñas queda en 5, el valor
// por defecto del modelo.
const recalculateUserRating = async (userId) => {
  const reviews = await Review.find({ reviewee_id: userId }).select('rating');
  const avg = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 5;
  await User.findByIdAndUpdate(userId, { rating: Math.round(avg * 100) / 100 });
};

//Function to create a review
exports.createReview = async (req, res, next) => {
  try {
    const { ride_id, reviewee_id, rating, comment } = req.body;

    // Check if ride exists and is completed
    const ride = await Ride.findById(ride_id);
    // Validate ride existence
    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }
    // Validate ride completion status. Aceptamos también
    // awaiting_payment_verification porque desde el punto de vista del
    // pasajero el viaje ya terminó físicamente (el conductor tocó
    // Finalizar) — solo falta que confirme pagos en PaymentVerification.
    // El pasajero puede calificar en paralelo.
    if (
      ride.status !== 'completed' &&
      ride.status !== 'awaiting_payment_verification'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed rides',
      });
    }

    // Check if user participated in the ride
    let isDriver = ride.driver_id.toString() === req.user._id.toString();
    
    // Look for any active booking (not cancelled)
    let booking = await Booking.findOne({
      ride_id: ride._id,
      passenger_id: req.user._id,
      status: { $in: ['confirmed', 'completed'] },
    });

    const isPassenger = !!booking;

    // Validate participation
    if (!isDriver && !isPassenger) {
      return res.status(403).json({
        success: false,
        message: 'v2: No puedes calificar un viaje en el que no participaste.',
      });
    }

    // Check if reviewing the correct person
    if (isDriver) {
      // The driver must review a passenger on this ride
      const passengerBooking = await Booking.findOne({
        ride_id: ride._id,
        passenger_id: reviewee_id,
        status: { $in: ['confirmed', 'completed'] },
      });
      
      if (!passengerBooking) {
        return res.status(400).json({
          success: false,
          message: `v2: Calificación inválida. El usuario ${reviewee_id} no tiene una reserva activa en este viaje.`,
        });
      }
    } else if (isPassenger) {
      // Validate passenger reviewee (must be the driver)
      if (reviewee_id.toString() !== ride.driver_id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'v2: Calificación inválida. Un pasajero solo puede calificar al conductor del viaje.',
        });
      }
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      ride_id,
      reviewer_id: req.user._id,
      reviewee_id,
    });
    // Validate existing review
    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: 'You have already reviewed this person for this ride',
      });
    }

    // Create review
    const review = await Review.create({
      ride_id,
      reviewer_id: req.user._id,
      reviewee_id,
      rating,
      comment,
    });

    await recalculateUserRating(reviewee_id);

    // [SAFESCORE-AGENT] — Notifica al agente que se creó una review. No-op si está deshabilitado.
    try { require('../../safescore-reviewer/agent/emit').onReviewCreated(review); } catch (_) {}
    // [SAFESCORE-AGENT] — fin

    // Populate review details
    await review.populate('reviewer_id reviewee_id', 'name username profileImage');
    // Respond successfully
    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get reviews for a user
// @route   GET /api/v1/reviews/user/:userId
// @access  Public

//Function to get reviews by user
exports.getReviewsByUser = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    // Fetch reviews
    const reviews = await Review.find({ reviewee_id: req.params.userId })
      .populate('ride_id', 'origin destination fecha hora')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });
    // Get total count for pagination
    const count = await Review.countDocuments({ reviewee_id: req.params.userId });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    // Respond with reviews and average rating
    const anonymized = reviews.map(r => {
      const obj = r.toObject();
      obj.reviewer_id = { name: 'Anónimo', profileImage: null };
      return obj;
    });

    res.status(200).json({
      success: true,
      data: anonymized,
      averageRating: avgRating.toFixed(2),
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

// @desc    Get reviews by ride
// @route   GET /api/v1/reviews/ride/:rideId
// @access  Private

//Function to get reviews by ride
exports.getReviewsByRide = async (req, res, next) => {
  // Fetch reviews by ride
  try {
    const reviews = await Review.find({ ride_id: req.params.rideId })
      .populate('reviewee_id', 'name username profileImage')
      .sort({ date: -1 });

    const anonymized = reviews.map(r => {
      const obj = r.toObject();
      obj.reviewer_id = { name: 'Anónimo', profileImage: null };
      return obj;
    });

    res.status(200).json({
      success: true,
      data: anonymized,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private

//Function to delete a review
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    // Validate review existence
    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Solo un administrador elimina reseñas (moderación). Si el autor
    // pudiera borrarla, podría usarla para presionar y reescribirla después.
    if (req.user.type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }
    // Delete review
    await review.deleteOne();

    await recalculateUserRating(review.reviewee_id);
    // Respond successfully
    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};