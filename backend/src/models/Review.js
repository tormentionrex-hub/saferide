const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  ride_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: [true, 'Ride ID is required'],
  },
  reviewer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewer ID is required'],
  },
  reviewee_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewee ID is required'],
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5'],
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [500, 'Comment cannot exceed 500 characters'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

// Indexes
reviewSchema.index({ ride_id: 1 });
reviewSchema.index({ reviewer_id: 1 });
reviewSchema.index({ reviewee_id: 1 });

// Compound index to prevent duplicate reviews
reviewSchema.index({ ride_id: 1, reviewer_id: 1, reviewee_id: 1 }, { unique: true });

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;