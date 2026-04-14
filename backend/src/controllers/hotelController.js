const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { checkAvailability } = require('../services/availabilityService');
const cloudinary = require('../config/cloudinary');
const { isAdminRole } = require('../middleware/roles');
const { attachOffersToHotels } = require('../utils/offerUtils');
const { emitHotelCatalogUpdate, emitHotelDetailUpdate } = require('../socket/socketHandler');
const { syncHotelToSql } = require('../services/sqlMirrorService');

const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildSearchClauses = (search = '') => {
  const terms = String(search)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  return terms.map((term) => {
    const regex = new RegExp(escapeRegex(term), 'i');
    return {
      $or: [
        { title: regex },
        { slug: regex },
        { description: regex },
        { type: regex },
        { amenities: regex },
        { 'address.city': regex },
        { 'address.state': regex },
        { 'address.country': regex },
      ],
    };
  });
};

// @desc    Get all hotels with filters, search, pagination
// @route   GET /api/v1/hotels
const getHotels = asyncHandler(async (req, res) => {
  const {
    city, minPrice, maxPrice, type, amenities, rating,
    sort = '-rating', page = 1, limit = 12, search,
  } = req.query;

  const query = { isActive: true };

  // Search by text
  if (search) {
    query.$and = [...(query.$and || []), ...buildSearchClauses(search)];
  }

  // Filter by city
  if (city) {
    query['address.city'] = { $regex: city, $options: 'i' };
  }

  // Price range
  if (minPrice || maxPrice) {
    query.pricePerNight = {};
    if (minPrice) query.pricePerNight.$gte = Number(minPrice);
    if (maxPrice) query.pricePerNight.$lte = Number(maxPrice);
  }

  // Type filter
  if (type) {
    query.type = type;
  }

  // Amenities filter
  if (amenities) {
    const amenityList = amenities.split(',');
    query.amenities = { $all: amenityList };
  }

  // Rating filter
  if (rating) {
    query.rating = { $gte: Number(rating) };
  }

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  // Sort mapping
  const sortOptions = {};
  if (sort.startsWith('-')) {
    sortOptions[sort.substring(1)] = -1;
  } else {
    sortOptions[sort] = 1;
  }

  const [hotels, total] = await Promise.all([
    Hotel.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum)
      .lean(),
    Hotel.countDocuments(query),
  ]);
  const hotelsWithOffers = await attachOffersToHotels(hotels);

  res.status(200).json(
    new ApiResponse(200, {
      hotels: hotelsWithOffers,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Get featured hotels
// @route   GET /api/v1/hotels/featured
const getFeaturedHotels = asyncHandler(async (req, res) => {
  const hotels = await Hotel.find({ isActive: true, isFeatured: true })
    .sort({ rating: -1 })
    .limit(8)
    .lean();
  const hotelsWithOffers = await attachOffersToHotels(hotels);

  res.status(200).json(new ApiResponse(200, { hotels: hotelsWithOffers }));
});

// @desc    Get popular destinations
// @route   GET /api/v1/hotels/popular-destinations
const getPopularDestinations = asyncHandler(async (req, res) => {
  const destinations = await Hotel.aggregate([
    { $match: { isActive: true } },
    {
      $group: {
        _id: '$address.city',
        count: { $sum: 1 },
        avgPrice: { $avg: '$pricePerNight' },
        avgRating: { $avg: '$rating' },
        state: { $first: '$address.state' },
        image: { $first: { $arrayElemAt: ['$images', 0] } },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $project: {
        city: '$_id',
        count: 1,
        avgPrice: { $round: ['$avgPrice', 0] },
        avgRating: { $round: ['$avgRating', 1] },
        state: 1,
        image: '$image.url',
      },
    },
  ]);

  res.status(200).json(new ApiResponse(200, { destinations }));
});

// @desc    Search suggestions (autocomplete)
// @route   GET /api/v1/hotels/search-suggestions
const getSearchSuggestions = asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.status(200).json(new ApiResponse(200, { suggestions: [] }));
  }

  const regex = new RegExp(escapeRegex(q), 'i');

  const [cities, hotels] = await Promise.all([
    Hotel.distinct('address.city', { 'address.city': regex, isActive: true }),
    Hotel.find({ title: regex, isActive: true })
      .select('title address.city slug')
      .limit(5)
      .lean(),
  ]);

  const suggestions = [
    ...cities.slice(0, 5).map((city) => ({ type: 'city', text: city })),
    ...hotels.map((h) => ({ type: 'hotel', text: h.title, slug: h.slug, city: h.address.city })),
  ];

  res.status(200).json(new ApiResponse(200, { suggestions }));
});

// @desc    Get single hotel by ID or slug
// @route   GET /api/v1/hotels/:idOrSlug
const getHotel = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params;

  let hotel;
  if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
    hotel = await Hotel.findById(idOrSlug).populate('createdBy', 'name avatar');
  } else {
    hotel = await Hotel.findOne({ slug: idOrSlug }).populate('createdBy', 'name avatar');
  }

  if (!hotel || !hotel.isActive) {
    throw new ApiError(404, 'Hotel not found');
  }

  // Get rooms for this hotel
  const rooms = await Room.find({ hotel: hotel._id, isActive: true }).lean();
  const [hotelWithOffers] = await attachOffersToHotels([hotel]);

  res.status(200).json(
    new ApiResponse(200, { hotel: hotelWithOffers, rooms })
  );
});

// @desc    Check hotel availability
// @route   GET /api/v1/hotels/:id/availability
const getAvailability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { checkIn, checkOut, guests } = req.query;

  if (!checkIn || !checkOut) {
    throw new ApiError(400, 'Check-in and check-out dates are required');
  }

  const availability = await checkAvailability(id, checkIn, checkOut, Number(guests) || 1);

  res.status(200).json(new ApiResponse(200, { availability }));
});

// @desc    Create hotel
// @route   POST /api/v1/hotels
const createHotel = asyncHandler(async (req, res) => {
  req.body.createdBy = req.user._id;

  const hotel = await Hotel.create(req.body);
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'created', hotelId: hotel._id });
  emitHotelDetailUpdate(hotel._id, { action: 'created' });

  res.status(201).json(
    new ApiResponse(201, { hotel }, 'Hotel created successfully')
  );
});

// @desc    Get hotels managed by the current admin/owner
// @route   GET /api/v1/hotels/manage/mine
const getManagedHotels = asyncHandler(async (req, res) => {
  const query = isAdminRole(req.user.role)
    ? {}
    : { createdBy: req.user._id };

  const hotels = await Hotel.find(query)
    .populate('createdBy', 'name email role')
    .sort('-createdAt')
    .lean();

  const hotelsWithOffers = await attachOffersToHotels(hotels);

  res.status(200).json(new ApiResponse(200, { hotels: hotelsWithOffers }));
});

// @desc    Update hotel
// @route   PUT /api/v1/hotels/:id
const updateHotel = asyncHandler(async (req, res) => {
  let hotel = req.managedHotel || await Hotel.findById(req.params.id);

  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  const updates = { ...req.body };
  delete updates.createdBy;

  hotel.set(updates);
  await hotel.save();
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'updated', hotelId: hotel._id });
  emitHotelDetailUpdate(hotel._id, { action: 'updated' });

  res.status(200).json(
    new ApiResponse(200, { hotel }, 'Hotel updated successfully')
  );
});

// @desc    Delete hotel (soft delete)
// @route   DELETE /api/v1/hotels/:id
const deleteHotel = asyncHandler(async (req, res) => {
  const hotel = req.managedHotel || await Hotel.findById(req.params.id);

  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  hotel.isActive = false;
  await hotel.save();
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'deleted', hotelId: hotel._id });
  emitHotelDetailUpdate(hotel._id, { action: 'deleted' });

  res.status(200).json(
    new ApiResponse(200, null, 'Hotel deleted successfully')
  );
});

// @desc    Upload hotel images
// @route   POST /api/v1/hotels/:id/images
const uploadImages = asyncHandler(async (req, res) => {
  const hotel = req.managedHotel || await Hotel.findById(req.params.id);

  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, 'No images provided');
  }

  const uploadPromises = req.files.map((file) =>
    new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'hotel-booking/hotels', transformation: { width: 1200, crop: 'limit' } },
        (error, result) => {
          if (error) reject(error);
          else resolve({ url: result.secure_url, publicId: result.public_id });
        }
      );
      stream.end(file.buffer);
    })
  );

  const uploadedImages = await Promise.all(uploadPromises);
  hotel.images.push(...uploadedImages);
  await hotel.save();
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'images-updated', hotelId: hotel._id });
  emitHotelDetailUpdate(hotel._id, { action: 'images-updated' });

  res.status(200).json(
    new ApiResponse(200, { images: hotel.images }, 'Images uploaded successfully')
  );
});

// @desc    Delete hotel image
// @route   DELETE /api/v1/hotels/:id/images/:imageId
const deleteImage = asyncHandler(async (req, res) => {
  const hotel = req.managedHotel || await Hotel.findById(req.params.id);

  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  const image = hotel.images.id(req.params.imageId);
  if (!image) {
    throw new ApiError(404, 'Image not found');
  }

  // Delete from Cloudinary
  if (image.publicId) {
    await cloudinary.uploader.destroy(image.publicId);
  }

  hotel.images.pull(req.params.imageId);
  await hotel.save();
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'images-updated', hotelId: hotel._id });
  emitHotelDetailUpdate(hotel._id, { action: 'images-updated' });

  res.status(200).json(
    new ApiResponse(200, null, 'Image deleted successfully')
  );
});

// @desc    Get recommendations for logged-in user
// @route   GET /api/v1/hotels/recommendations
const getRecommendations = asyncHandler(async (req, res) => {
  const { getRecommendations: recommend } = require('../services/recommendationService');
  const hotels = await recommend(req.user._id, 8);
  const hotelsWithOffers = await attachOffersToHotels(hotels);
  res.status(200).json(new ApiResponse(200, { hotels: hotelsWithOffers }));
});

module.exports = {
  getHotels,
  getFeaturedHotels,
  getPopularDestinations,
  getSearchSuggestions,
  getHotel,
  getAvailability,
  createHotel,
  getManagedHotels,
  updateHotel,
  deleteHotel,
  uploadImages,
  deleteImage,
  getRecommendations,
};
