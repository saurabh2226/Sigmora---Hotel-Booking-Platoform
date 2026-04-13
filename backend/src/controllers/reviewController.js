const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { syncReviewToSql, markReviewDeletedInSql, syncHotelToSql } = require('../services/sqlMirrorService');

// @desc    Create review
// @route   POST /api/v1/reviews
const createReview = asyncHandler(async (req, res) => {
  const { hotel, booking: bookingId, rating, title, comment, categories } = req.body;

  // Verify user has a completed booking
  const booking = await Booking.findOne({
    _id: bookingId,
    user: req.user._id,
    hotel,
    status: 'checked-out',
  });

  if (!booking) {
    throw new ApiError(400, 'You can only review after a completed stay');
  }

  // Check if already reviewed
  const existingReview = await Review.findOne({ user: req.user._id, booking: bookingId });
  if (existingReview) {
    throw new ApiError(409, 'You have already reviewed this booking');
  }

  const review = await Review.create({
    user: req.user._id,
    hotel,
    booking: bookingId,
    rating,
    title,
    comment,
    categories,
  });

  await review.populate('user', 'name avatar');
  await syncReviewToSql(review);
  const refreshedHotel = await Hotel.findById(hotel);
  if (refreshedHotel) {
    await syncHotelToSql(refreshedHotel);
  }

  res.status(201).json(
    new ApiResponse(201, { review }, 'Review submitted successfully')
  );
});

// @desc    Get hotel reviews
// @route   GET /api/v1/reviews/hotel/:hotelId
const getHotelReviews = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const sortObj = {};
  if (sort.startsWith('-')) sortObj[sort.substring(1)] = -1;
  else sortObj[sort] = 1;

  const [reviews, total] = await Promise.all([
    Review.find({ hotel: req.params.hotelId })
      .populate('user', 'name avatar')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Review.countDocuments({ hotel: req.params.hotelId }),
  ]);

  // Calculate category averages
  const categoryStats = await Review.aggregate([
    { $match: { hotel: require('mongoose').Types.ObjectId.createFromHexString(req.params.hotelId) } },
    {
      $group: {
        _id: null,
        avgCleanliness: { $avg: '$categories.cleanliness' },
        avgComfort: { $avg: '$categories.comfort' },
        avgLocation: { $avg: '$categories.location' },
        avgFacilities: { $avg: '$categories.facilities' },
        avgStaff: { $avg: '$categories.staff' },
        avgValueForMoney: { $avg: '$categories.valueForMoney' },
        avgOverall: { $avg: '$rating' },
      },
    },
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      reviews,
      categoryStats: categoryStats[0] || null,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Update review
// @route   PUT /api/v1/reviews/:id
const updateReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  if (review.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to update this review');
  }

  const { rating, title, comment, categories } = req.body;

  if (rating) review.rating = rating;
  if (title !== undefined) review.title = title;
  if (comment) review.comment = comment;
  if (categories) review.categories = { ...review.categories, ...categories };

  await review.save();
  await review.populate('user', 'name avatar');
  await syncReviewToSql(review);
  const refreshedHotel = await Hotel.findById(review.hotel);
  if (refreshedHotel) {
    await syncHotelToSql(refreshedHotel);
  }

  res.status(200).json(
    new ApiResponse(200, { review }, 'Review updated')
  );
});

// @desc    Delete review
// @route   DELETE /api/v1/reviews/:id
const deleteReview = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  // Owner or admin can delete
  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    throw new ApiError(403, 'Not authorized to delete this review');
  }

  await Review.findByIdAndDelete(req.params.id);
  await markReviewDeletedInSql(req.params.id);
  const refreshedHotel = await Hotel.findById(review.hotel);
  if (refreshedHotel) {
    await syncHotelToSql(refreshedHotel);
  }

  res.status(200).json(
    new ApiResponse(200, null, 'Review deleted')
  );
});

// @desc    Toggle helpful vote
// @route   POST /api/v1/reviews/:id/helpful
const toggleHelpful = asyncHandler(async (req, res) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }

  const userIdx = review.helpfulBy.indexOf(req.user._id);
  if (userIdx === -1) {
    review.helpfulBy.push(req.user._id);
    review.helpfulCount += 1;
  } else {
    review.helpfulBy.splice(userIdx, 1);
    review.helpfulCount -= 1;
  }

  await review.save();
  await syncReviewToSql(review);

  res.status(200).json(
    new ApiResponse(200, { helpfulCount: review.helpfulCount }, 'Helpful vote toggled')
  );
});

// @desc    Admin responds to review
// @route   POST /api/v1/reviews/:id/respond
const respondToReview = asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    throw new ApiError(400, 'Response text is required');
  }

  const review = await Review.findByIdAndUpdate(
    req.params.id,
    {
      response: { text, respondedAt: new Date() },
    },
    { new: true }
  ).populate('user', 'name avatar');

  if (!review) {
    throw new ApiError(404, 'Review not found');
  }
  await syncReviewToSql(review);
  const refreshedHotel = await Hotel.findById(review.hotel);
  if (refreshedHotel) {
    await syncHotelToSql(refreshedHotel);
  }

  res.status(200).json(
    new ApiResponse(200, { review }, 'Response added')
  );
});

module.exports = {
  createReview,
  getHotelReviews,
  updateReview,
  deleteReview,
  toggleHelpful,
  respondToReview,
};
