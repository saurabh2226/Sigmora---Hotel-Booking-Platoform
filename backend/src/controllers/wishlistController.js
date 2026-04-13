const Wishlist = require('../models/Wishlist');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get user's wishlist
// @route   GET /api/v1/wishlist
const getWishlist = asyncHandler(async (req, res) => {
  const wishlist = await Wishlist.find({ user: req.user._id })
    .populate('hotel', 'title slug images address rating totalReviews pricePerNight type amenities')
    .sort('-createdAt')
    .lean();

  const hotels = wishlist.map((w) => ({ ...w.hotel, wishlistId: w._id }));

  res.status(200).json(new ApiResponse(200, { hotels }));
});

// @desc    Toggle wishlist
// @route   POST /api/v1/wishlist/:hotelId
const toggleWishlist = asyncHandler(async (req, res) => {
  const { hotelId } = req.params;

  const existing = await Wishlist.findOne({ user: req.user._id, hotel: hotelId });

  if (existing) {
    await Wishlist.findByIdAndDelete(existing._id);
    return res.status(200).json(
      new ApiResponse(200, { wishlisted: false }, 'Removed from wishlist')
    );
  }

  await Wishlist.create({ user: req.user._id, hotel: hotelId });
  res.status(201).json(
    new ApiResponse(201, { wishlisted: true }, 'Added to wishlist')
  );
});

// @desc    Remove from wishlist
// @route   DELETE /api/v1/wishlist/:hotelId
const removeFromWishlist = asyncHandler(async (req, res) => {
  const result = await Wishlist.findOneAndDelete({
    user: req.user._id,
    hotel: req.params.hotelId,
  });

  if (!result) {
    throw new ApiError(404, 'Not found in wishlist');
  }

  res.status(200).json(new ApiResponse(200, null, 'Removed from wishlist'));
});

module.exports = { getWishlist, toggleWishlist, removeFromWishlist };
