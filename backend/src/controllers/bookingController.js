const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const Coupon = require('../models/Coupon');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isRoomAvailable } = require('../services/availabilityService');
const { calculateDynamicPricing } = require('../services/pricingService');
const {
  acquireRoomHold,
  confirmRoomInventoryForBooking,
  expireStalePendingBookings,
  isHoldActive,
  releaseConfirmedInventoryForBooking,
  releaseRoomHoldForBooking,
} = require('../services/bookingLifecycleService');
const { getRefundDecision } = require('../services/refundPolicyService');
const { notifyNewBooking, notifyBookingStatusUpdate } = require('../services/notificationService');
const {
  sendBookingHoldEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendOwnerBookingAlertEmail,
} = require('../services/emailService');
const { processRazorpayRefund } = require('../services/paymentService');
const { emitAvailabilityUpdate } = require('../socket/socketHandler');
const { isAdminRole } = require('../middleware/roles');
const { syncBookingToSql, syncCouponToSql } = require('../services/sqlMirrorService');

const runSideEffect = (task) => {
  Promise.resolve()
    .then(task)
    .catch(console.error);
};

// @desc    Create booking
// @route   POST /api/v1/bookings
const createBooking = asyncHandler(async (req, res) => {
  const { hotel: hotelId, room: roomId, checkIn, checkOut, guests, guestDetails, couponCode } = req.body;
  await expireStalePendingBookings();

  // Validate dates
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (checkInDate >= checkOutDate) {
    throw new ApiError(400, 'Check-out date must be after check-in date');
  }
  if (checkInDate < today) {
    throw new ApiError(400, 'Check-in date cannot be in the past');
  }

  // Check hotel exists
  const hotel = await Hotel.findById(hotelId);
  if (!hotel || !hotel.isActive) {
    throw new ApiError(404, 'Hotel not found');
  }

  // Check room exists and is available
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    throw new ApiError(404, 'Room not found');
  }
  if (room.hotel.toString() !== hotelId.toString()) {
    throw new ApiError(400, 'Selected room does not belong to this hotel');
  }

  const available = await isRoomAvailable(roomId, checkIn, checkOut);
  if (!available) {
    throw new ApiError(400, 'Room is not available for the selected dates');
  }

  let appliedCoupon = null;
  let couponDocument = null;
  if (couponCode) {
    couponDocument = await Coupon.findOne({
      code: couponCode.toUpperCase(),
      $or: [{ hotel: hotelId }, { hotel: null }],
    });

    if (!couponDocument || !couponDocument.isValid()) {
      throw new ApiError(400, 'Coupon is invalid or not applicable to this hotel');
    }

    appliedCoupon = couponDocument.code;
    const pricingPreview = calculateDynamicPricing({
      baseRate: room.pricePerNight,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      coupon: couponDocument,
    });

    if (pricingPreview.discount <= 0) {
      throw new ApiError(400, 'Coupon does not apply to the current booking amount');
    }
  }

  const pricing = calculateDynamicPricing({
    baseRate: room.pricePerNight,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    coupon: couponDocument,
  });

  let holdMeta;
  try {
    holdMeta = await acquireRoomHold({
      room,
      hotelId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
    });
  } catch (error) {
    if (error.message === 'ROOM_UNAVAILABLE') {
      throw new ApiError(409, 'Another guest just locked this room. Please try a different room or dates.');
    }
    if (error.message === 'LOCK_ACQUISITION_TIMEOUT') {
      throw new ApiError(409, 'This room is handling another booking right now. Please retry in a moment.');
    }
    throw error;
  }

  let booking;
  try {
    booking = await Booking.create({
      user: req.user._id,
      hotel: hotelId,
      room: roomId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      guests: guests || { adults: 1, children: 0 },
      guestDetails: {
        ...guestDetails,
        specialRequests: guestDetails?.specialRequests || '',
      },
      holdExpiresAt: holdMeta.holdExpiresAt,
      payment: {
        method: 'razorpay',
        status: 'pending',
      },
      pricing: {
        ...pricing,
        couponCode: appliedCoupon,
      },
    });
  } catch (error) {
    await releaseRoomHoldForBooking({
      room: roomId,
      hotel: hotelId,
      checkIn: checkInDate,
      checkOut: checkOutDate,
    });
    throw error;
  }

  // Increment coupon usage
  if (appliedCoupon) {
    const updatedCoupon = await Coupon.findOneAndUpdate(
      { code: appliedCoupon },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (updatedCoupon) {
      await syncCouponToSql(updatedCoupon);
    }
  }

  await syncBookingToSql(booking);

  // Notify
  runSideEffect(() => notifyNewBooking(booking, req.user, hotel));
  runSideEffect(() => sendBookingHoldEmail(req.user, booking, hotel, room));

  // Emit availability update
  emitAvailabilityUpdate(hotelId, {
    roomId,
    checkIn,
    checkOut,
    action: 'hold-created',
    holdExpiresAt: booking.holdExpiresAt,
  });

  res.status(201).json(
    new ApiResponse(201, { booking }, 'Booking created successfully')
  );
});

// @desc    Get user's bookings
// @route   GET /api/v1/bookings/my-bookings
const getMyBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  await expireStalePendingBookings();

  const query = { user: req.user._id };
  if (status) query.status = status;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const sortObj = {};
  if (sort.startsWith('-')) sortObj[sort.substring(1)] = -1;
  else sortObj[sort] = 1;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('hotel', 'title slug images address rating')
      .populate('room', 'title type pricePerNight')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
const getBooking = asyncHandler(async (req, res) => {
  await expireStalePendingBookings();
  const booking = await Booking.findById(req.params.id)
    .populate('hotel', 'title slug images address rating contact policies createdBy')
    .populate('room', 'title type pricePerNight bedType amenities images')
    .populate('user', 'name email phone');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  const canViewAsOwner = booking.hotel?.createdBy?.toString() === req.user._id.toString();

  if (
    booking.user._id.toString() !== req.user._id.toString() &&
    !isAdminRole(req.user.role) &&
    !canViewAsOwner
  ) {
    throw new ApiError(403, 'Not authorized to view this booking');
  }

  res.status(200).json(new ApiResponse(200, { booking }));
});

// @desc    Get bookings for hotels owned by the current owner
// @route   GET /api/v1/owner/bookings
const getOwnerBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, sort = '-createdAt' } = req.query;
  await expireStalePendingBookings();
  const hotelIds = await Hotel.find({ createdBy: req.user._id }).distinct('_id');

  const query = { hotel: { $in: hotelIds } };
  if (status) query.status = status;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const sortObj = {};

  if (sort.startsWith('-')) sortObj[sort.substring(1)] = -1;
  else sortObj[sort] = 1;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('hotel', 'title slug address')
      .populate('room', 'title type')
      .populate('user', 'name email phone')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query),
  ]);

  res.status(200).json(new ApiResponse(200, {
    bookings,
    currentPage: pageNum,
    totalPages: Math.ceil(total / limitNum),
    totalResults: total,
  }));
});

// @desc    Cancel booking
// @route   PUT /api/v1/bookings/:id/cancel
const cancelBooking = asyncHandler(async (req, res) => {
  await expireStalePendingBookings();
  const booking = await Booking.findById(req.params.id).populate('hotel');

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized to cancel this booking');
  }

  if (['cancelled', 'checked-in', 'checked-out'].includes(booking.status)) {
    throw new ApiError(400, `Cannot cancel a booking with status: ${booking.status}`);
  }

  let refundResult = null;
  const refundDecision = getRefundDecision(booking);
  let refundAmount = refundDecision.refundAmount;

  if (booking.status === 'pending' && isHoldActive(booking)) {
    await releaseRoomHoldForBooking(booking);
    booking.payment.status = 'failed';
  } else if (booking.status === 'confirmed' && booking.payment.status === 'completed') {
    await releaseConfirmedInventoryForBooking(booking);

    if (refundAmount > 0 && booking.payment.method === 'razorpay' && booking.payment.transactionId) {
      refundResult = await processRazorpayRefund(booking.payment.transactionId, refundAmount);
      booking.payment.refundId = refundResult.refundId;
      booking.payment.refundedAt = new Date();
      booking.payment.status = refundAmount < booking.pricing.totalPrice ? 'partial_refunded' : 'refunded';
    }
  } else if (booking.status === 'pending') {
    booking.payment.status = 'failed';
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || 'Cancelled by user';
  booking.refundAmount = refundAmount;
  booking.holdExpiresAt = null;
  await booking.save();
  await syncBookingToSql(booking);

  const owner = booking.hotel?.createdBy
    ? await User.findById(booking.hotel.createdBy).select('name email')
    : null;

  // Notify
  runSideEffect(() => notifyBookingStatusUpdate(booking, booking.hotel, 'cancelled'));
  runSideEffect(() => sendBookingCancellationEmail(req.user, booking, booking.hotel));
  if (owner?.email) {
    runSideEffect(() => sendOwnerBookingAlertEmail({
      owner,
      guest: req.user,
      booking,
      hotel: booking.hotel,
      room: { title: booking.room?.title },
      action: 'cancelled',
    }));
  }

  // Emit availability update
  emitAvailabilityUpdate(booking.hotel._id, {
    roomId: booking.room,
    action: 'freed',
    refundAmount,
  });

  res.status(200).json(
    new ApiResponse(200, {
      booking,
      refundAmount,
      refundPolicy: refundDecision.summary,
      refundResult,
    }, 'Booking cancelled')
  );
});

// @desc    Get all bookings (admin)
// @route   GET /api/v1/bookings
const getAllBookings = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, sort = '-createdAt', hotel, user } = req.query;
  await expireStalePendingBookings();

  const query = {};
  if (status) query.status = status;
  if (hotel) query.hotel = hotel;
  if (user) query.user = user;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const sortObj = {};
  if (sort.startsWith('-')) sortObj[sort.substring(1)] = -1;
  else sortObj[sort] = 1;

  const [bookings, total] = await Promise.all([
    Booking.find(query)
      .populate('hotel', 'title slug address')
      .populate('room', 'title type')
      .populate('user', 'name email')
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Booking.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      bookings,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Update booking status (admin/owner)
// @route   PUT /api/v1/bookings/:id/status
const updateBookingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'];
  await expireStalePendingBookings();

  if (!validStatuses.includes(status)) {
    throw new ApiError(400, 'Invalid status');
  }

  const booking = await Booking.findById(req.params.id).populate('hotel');
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }
  const previousStatus = booking.status;

  const canManageAsOwner = booking.hotel?.createdBy?.toString() === req.user._id.toString();
  if (!isAdminRole(req.user.role) && !canManageAsOwner) {
    throw new ApiError(403, 'You can only manage bookings for your own hotels');
  }

  booking.status = status;
  if (status === 'confirmed' && booking.payment.status === 'completed' && previousStatus === 'pending') {
    try {
      await confirmRoomInventoryForBooking(booking);
    } catch (error) {
      if (error.message === 'INVENTORY_SYNC_FAILED') {
        throw new ApiError(409, 'The pending room hold could not be confirmed anymore.');
      }
      throw error;
    }
    booking.holdExpiresAt = null;
  }

  if (status === 'cancelled' && previousStatus === 'pending') {
    await releaseRoomHoldForBooking(booking);
    booking.payment.status = booking.payment.status === 'pending' ? 'failed' : booking.payment.status;
    booking.holdExpiresAt = null;
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body.reason || 'Cancelled by administrator';
  }

  if (status === 'cancelled' && ['confirmed', 'checked-in'].includes(previousStatus)) {
    await releaseConfirmedInventoryForBooking(booking);
    booking.cancelledAt = new Date();
    booking.cancellationReason = req.body.reason || 'Cancelled by administrator';
  }
  await booking.save();
  await syncBookingToSql(booking);

  // Notify user
  notifyBookingStatusUpdate(booking, booking.hotel, status).catch(console.error);

  if (status === 'confirmed') {
    const user = await User.findById(booking.user);
    sendBookingConfirmationEmail(user, booking, booking.hotel).catch(console.error);
  }

  if (status === 'cancelled') {
    const user = await User.findById(booking.user);
    if (user?.email) {
      sendBookingCancellationEmail(user, booking, booking.hotel).catch(console.error);
    }
  }

  res.status(200).json(
    new ApiResponse(200, { booking }, 'Booking status updated')
  );
});

module.exports = {
  createBooking,
  getMyBookings,
  getBooking,
  getOwnerBookings,
  cancelBooking,
  getAllBookings,
  updateBookingStatus,
};
