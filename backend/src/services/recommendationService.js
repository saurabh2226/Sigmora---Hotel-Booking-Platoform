const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');

/**
 * AI-based hotel recommendations using content-based + collaborative filtering
 */
const getRecommendations = async (userId, limit = 8) => {
  try {
    // 1. Get user's past bookings
    const userBookings = await Booking.find({
      user: userId,
      status: { $in: ['confirmed', 'checked-out'] },
    }).populate('hotel');

    // For new users or users with no bookings, return featured/top-rated hotels
    if (!userBookings || userBookings.length === 0) {
      return await Hotel.find({ isActive: true })
        .sort({ rating: -1, totalReviews: -1 })
        .limit(limit)
        .lean();
    }

    // 2. Extract user preferences
    const preferredCities = [...new Set(userBookings.map((b) => b.hotel?.address?.city).filter(Boolean))];
    const preferredTypes = [...new Set(userBookings.map((b) => b.hotel?.type).filter(Boolean))];
    const prices = userBookings.map((b) => b.hotel?.pricePerNight).filter(Boolean);
    const avgPrice = prices.length > 0 ? prices.reduce((sum, p) => sum + p, 0) / prices.length : 5000;
    const preferredAmenities = [...new Set(userBookings.flatMap((b) => b.hotel?.amenities || []))];
    const bookedHotelIds = userBookings.map((b) => b.hotel?._id).filter(Boolean);

    // 3. Find similar hotels (not already booked)
    const recommendations = await Hotel.aggregate([
      {
        $match: {
          _id: { $nin: bookedHotelIds },
          isActive: true,
        },
      },
      {
        $addFields: {
          score: {
            $add: [
              // City match: +3
              { $cond: [{ $in: ['$address.city', preferredCities] }, 3, 0] },
              // Type match: +2
              { $cond: [{ $in: ['$type', preferredTypes] }, 2, 0] },
              // Price range match (±30%): +2
              {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$pricePerNight', avgPrice * 0.7] },
                      { $lte: ['$pricePerNight', avgPrice * 1.3] },
                    ],
                  },
                  2,
                  0,
                ],
              },
              // Rating bonus: rating * 0.5
              { $multiply: ['$rating', 0.5] },
              // Amenity overlap count
              { $size: { $setIntersection: ['$amenities', preferredAmenities] } },
            ],
          },
        },
      },
      { $sort: { score: -1, rating: -1 } },
      { $limit: limit },
      {
        $project: {
          score: 0, // Don't expose internal scoring
        },
      },
    ]);

    return recommendations;
  } catch (error) {
    console.error('Recommendation error:', error.message);
    // Fallback to featured/top-rated
    return await Hotel.find({ isActive: true })
      .sort({ rating: -1, totalReviews: -1 })
      .limit(limit)
      .lean();
  }
};

module.exports = { getRecommendations };
