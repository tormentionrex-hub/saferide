const { Review, Ride, Booking, User } = require('../models');

// @desc    Create a review
// @route   POST /api/v1/reviews
// @access  Private
exports.createReview = async (req, res, next) => {
  try {
    const { ride_id, reviewee_id, rating, comment } = req.body;

    // Check if ride exists and is completed
    const ride = await Ride.findById(ride_id);

    if (!ride) {
      return res.status(404).json({
        success: false,
        message: 'Ride not found',
      });
    }

    if (ride.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Can only review completed rides',
      });
    }

    // Check if user participated in the ride
    const isDriver = ride.driver_id.toString() === req.user._id.toString();
    const isPassenger = await Booking.findOne({
      ride_id,
      passenger_id: req.user._id,
      status: 'completed',
    });

    if (!isDriver && !isPassenger) {
      return res.status(403).json({
        success: false,
        message: 'You can only review rides you participated in',
      });
    }

    // Check if reviewing the correct person
    if (isDriver && reviewee_id !== isPassenger?.passenger_id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reviewee',
      });
    }

    if (isPassenger && reviewee_id !== ride.driver_id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid reviewee',
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({
      ride_id,
      reviewer_id: req.user._id,
      reviewee_id,
    });

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

    // Update user's average rating
    const reviews = await Review.find({ reviewee_id });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    
    await User.findByIdAndUpdate(reviewee_id, { rating: avgRating });

    await review.populate('reviewer_id reviewee_id', 'name username profileImage');

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
exports.getReviewsByUser = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.find({ reviewee_id: req.params.userId })
      .populate('reviewer_id', 'name username profileImage')
      .populate('ride_id', 'origin destination date_time')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ date: -1 });

    const count = await Review.countDocuments({ reviewee_id: req.params.userId });

    // Calculate average rating
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.status(200).json({
      success: true,
      data: reviews,
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
exports.getReviewsByRide = async (req, res, next) => {
  try {
    const reviews = await Review.find({ ride_id: req.params.rideId })
      .populate('reviewer_id reviewee_id', 'name username profileImage')
      .sort({ date: -1 });

    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        message: 'Review not found',
      });
    }

    // Check if user owns the review or is admin
    if (
      review.reviewer_id.toString() !== req.user._id.toString() &&
      req.user.type !== 'administrador'
    ) {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
      });
    }

    await review.deleteOne();

    // Recalculate user's average rating
    const reviews = await Review.find({ reviewee_id: review.reviewee_id });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 5;
    
    await User.findByIdAndUpdate(review.reviewee_id, { rating: avgRating });

    res.status(200).json({
      success: true,
      message: 'Review deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};