const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { checkAvailability } = require('../services/availabilityService');
const cloudinary = require('../config/cloudinary');
const { isAdminRole } = require('../middleware/roles');
const { attachOffersToHotels } = require('../utils/offerUtils');
const { emitHotelCatalogUpdate, emitHotelDetailUpdate } = require('../socket/socketHandler');
const { syncHotelToSql } = require('../services/sqlMirrorService');
const { createNotification } = require('../services/notificationService');
const { sendHotelDeletedOwnerEmail, sendHotelDeletedGuestEmail } = require('../services/emailService');

const runSideEffect = (task) => {
  Promise.resolve()
    .then(task)
    .catch(console.error);
};

const uploadImageToCloudinary = (file) => new Promise((resolve, reject) => {
  let settled = false;

  const fail = (error) => {
    if (settled) {
      return;
    }
    settled = true;
    reject(error instanceof ApiError ? error : new ApiError(502, error.message || 'Failed to upload hotel image'));
  };

  const succeed = (result) => {
    if (settled) {
      return;
    }
    settled = true;
    resolve({ url: result.secure_url, publicId: result.public_id });
  };

  try {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'hotel-booking/hotels', transformation: { width: 1200, crop: 'limit' } },
      (error, result) => {
        if (error) {
          fail(new ApiError(502, error.message || 'Failed to upload hotel image'));
          return;
        }

        if (!result?.secure_url || !result?.public_id) {
          fail(new ApiError(502, 'Image service did not return a valid upload response'));
          return;
        }

        succeed(result);
      }
    );

    if (typeof stream.on === 'function') {
      stream.on('error', (error) => {
        fail(new ApiError(502, error.message || 'Failed to upload hotel image'));
      });
    }

    stream.end(file.buffer);
  } catch (error) {
    fail(new ApiError(502, error.message || 'Failed to upload hotel image'));
  }
});

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
  const hotelIds = hotelsWithOffers.map((hotel) => hotel._id);
  const rooms = hotelIds.length > 0
    ? await Room.find({ hotel: { $in: hotelIds }, isActive: true })
      .select('hotel title type totalRooms maxGuests pricePerNight roomSize')
      .sort({ createdAt: -1 })
      .lean()
    : [];

  const roomsByHotelId = rooms.reduce((map, room) => {
    const hotelId = String(room.hotel);
    if (!map[hotelId]) {
      map[hotelId] = [];
    }
    map[hotelId].push(room);
    return map;
  }, {});

  const hotelsWithRoomPreview = hotelsWithOffers.map((hotel) => {
    const activeRooms = roomsByHotelId[String(hotel._id)] || [];
    return {
      ...hotel,
      roomCount: activeRooms.length,
      roomsPreview: activeRooms.slice(0, 3),
    };
  });

  res.status(200).json(new ApiResponse(200, { hotels: hotelsWithRoomPreview }));
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

  const [owner, activeBookings] = await Promise.all([
    hotel.createdBy ? User.findById(hotel.createdBy).select('name email') : null,
    Booking.find({
      hotel: hotel._id,
      status: { $ne: 'cancelled' },
    })
      .populate('user', 'name email')
      .lean(),
  ]);

  if (owner?._id) {
    runSideEffect(() => createNotification({
      userId: owner._id,
      type: 'system',
      title: 'Hotel removed from listings',
      message: `${hotel.title} was removed from active listings.`,
      link: '/admin/hotels',
      metadata: { hotelId: hotel._id },
    }));
    runSideEffect(() => sendHotelDeletedOwnerEmail({
      owner,
      hotel,
      deletedBy: req.user,
    }));
  }

  const notifiedGuestIds = new Set();
  activeBookings.forEach((booking) => {
    const guest = booking.user;
    if (!guest?._id) {
      return;
    }

    const guestId = String(guest._id);
    if (notifiedGuestIds.has(guestId)) {
      return;
    }
    notifiedGuestIds.add(guestId);

    runSideEffect(() => createNotification({
      userId: guest._id,
      type: 'system',
      title: 'Hotel no longer available',
      message: `${hotel.title} has been removed from active listings.`,
      link: '/dashboard',
      metadata: { hotelId: hotel._id, bookingId: booking._id },
    }));
    runSideEffect(() => sendHotelDeletedGuestEmail({
      guest,
      hotel,
      booking,
    }));
  });

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

  if (typeof cloudinary.isConfigured === 'function' && !cloudinary.isConfigured()) {
    throw new ApiError(503, cloudinary.getConfigError?.() || 'Hotel image uploads are temporarily unavailable.');
  }

  const uploadedImages = await Promise.all(req.files.map((file) => uploadImageToCloudinary(file)));
  hotel.images = [...uploadedImages, ...hotel.images];
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
  if (image.publicId && typeof cloudinary.isConfigured === 'function' && cloudinary.isConfigured()) {
    try {
      await cloudinary.uploader.destroy(image.publicId);
    } catch (error) {
      console.error('Cloudinary delete error:', error.message);
    }
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
