const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { hotelManager, requireHotelManagementAccess } = require('../middleware/roles');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const { createHotelValidation, createRoomValidation } = require('../utils/validators');
const {
  getHotels, getFeaturedHotels, getPopularDestinations, getSearchSuggestions,
  getHotel, getAvailability, createHotel, getManagedHotels, updateHotel, deleteHotel,
  uploadImages, deleteImage, getRecommendations,
} = require('../controllers/hotelController');

// Room controller
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const asyncHandler = require('../utils/asyncHandler');
const ApiResponse = require('../utils/ApiResponse');
const ApiError = require('../utils/ApiError');
const { emitHotelCatalogUpdate, emitHotelDetailUpdate } = require('../socket/socketHandler');
const { syncHotelToSql, syncRoomToSql } = require('../services/sqlMirrorService');

const syncHotelDerivedMetrics = async (hotelId) => {
  const activeRooms = await Room.find({ hotel: hotelId, isActive: true })
    .select('pricePerNight totalRooms maxGuests')
    .lean();

  if (!activeRooms.length) {
    return;
  }

  const minPrice = Math.min(...activeRooms.map((room) => room.pricePerNight || 0));
  const totalRooms = activeRooms.reduce((sum, room) => sum + (room.totalRooms || 0), 0);
  const maxGuests = Math.max(...activeRooms.map((room) => room.maxGuests || 1));

  await Hotel.findByIdAndUpdate(hotelId, {
    pricePerNight: minPrice,
    totalRooms,
    maxGuests,
  });
};

// Public routes
router.get('/featured', getFeaturedHotels);
router.get('/popular-destinations', getPopularDestinations);
router.get('/search-suggestions', getSearchSuggestions);
router.get('/recommendations', auth, getRecommendations);
router.get('/manage/mine', auth, hotelManager, getManagedHotels);
router.get('/', getHotels);
router.get('/:idOrSlug', getHotel);
router.get('/:id/availability', getAvailability);

// Admin and owner routes
router.post('/', auth, hotelManager, createHotelValidation, validate, createHotel);
router.put('/:id', auth, hotelManager, requireHotelManagementAccess('id'), updateHotel);
router.delete('/:id', auth, hotelManager, requireHotelManagementAccess('id'), deleteHotel);
router.post('/:id/images', auth, hotelManager, requireHotelManagementAccess('id'), upload.array('images', 10), uploadImages);
router.delete('/:id/images/:imageId', auth, hotelManager, requireHotelManagementAccess('id'), deleteImage);

// ===== ROOM SUB-ROUTES =====
// GET rooms for a hotel
router.get('/:hotelId/rooms', asyncHandler(async (req, res) => {
  const rooms = await Room.find({ hotel: req.params.hotelId, isActive: true }).lean();
  res.status(200).json(new ApiResponse(200, { rooms }));
}));

// GET single room
router.get('/:hotelId/rooms/:roomId', asyncHandler(async (req, res) => {
  const room = await Room.findOne({ _id: req.params.roomId, hotel: req.params.hotelId });
  if (!room) throw new ApiError(404, 'Room not found');
  res.status(200).json(new ApiResponse(200, { room }));
}));

// POST create room (admin/owner)
router.post('/:hotelId/rooms', auth, hotelManager, requireHotelManagementAccess('hotelId'), createRoomValidation, validate, asyncHandler(async (req, res) => {
  req.body.hotel = req.params.hotelId;
  const room = await Room.create(req.body);
  await syncHotelDerivedMetrics(req.params.hotelId);
  await syncRoomToSql(room);
  const hotel = await Hotel.findById(req.params.hotelId);
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'room-created', hotelId: req.params.hotelId, roomId: room._id });
  emitHotelDetailUpdate(req.params.hotelId, { action: 'room-created', roomId: room._id });
  res.status(201).json(new ApiResponse(201, { room }, 'Room created'));
}));

// PUT update room (admin/owner)
router.put('/:hotelId/rooms/:roomId', auth, hotelManager, requireHotelManagementAccess('hotelId'), asyncHandler(async (req, res) => {
  const room = await Room.findOneAndUpdate(
    { _id: req.params.roomId, hotel: req.params.hotelId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!room) throw new ApiError(404, 'Room not found');
  await syncHotelDerivedMetrics(req.params.hotelId);
  await syncRoomToSql(room);
  const hotel = await Hotel.findById(req.params.hotelId);
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'room-updated', hotelId: req.params.hotelId, roomId: room._id });
  emitHotelDetailUpdate(req.params.hotelId, { action: 'room-updated', roomId: room._id });
  res.status(200).json(new ApiResponse(200, { room }, 'Room updated'));
}));

// DELETE room (admin/owner)
router.delete('/:hotelId/rooms/:roomId', auth, hotelManager, requireHotelManagementAccess('hotelId'), asyncHandler(async (req, res) => {
  const room = await Room.findOneAndUpdate(
    { _id: req.params.roomId, hotel: req.params.hotelId },
    { isActive: false },
    { new: true }
  );
  if (!room) throw new ApiError(404, 'Room not found');
  await syncHotelDerivedMetrics(req.params.hotelId);
  await syncRoomToSql(room);
  const hotel = await Hotel.findById(req.params.hotelId);
  await syncHotelToSql(hotel);
  emitHotelCatalogUpdate({ action: 'room-deleted', hotelId: req.params.hotelId, roomId: room._id });
  emitHotelDetailUpdate(req.params.hotelId, { action: 'room-deleted', roomId: room._id });
  res.status(200).json(new ApiResponse(200, null, 'Room deleted'));
}));

module.exports = router;
