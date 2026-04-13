const { Op } = require('sequelize');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const Coupon = require('../models/Coupon');
const SupportConversation = require('../models/SupportConversation');
const OwnerCommunityThread = require('../models/OwnerCommunityThread');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { createNotification } = require('../services/notificationService');
const { Booking: SqlBooking } = require('../models/sql');

const COMMUNITY_CATEGORIES = ['general', 'operations', 'pricing', 'marketing', 'support', 'growth', 'admin-updates'];
const COMPLETED_PAYMENT_STATUSES = new Set(['completed', 'partial_refunded', 'refunded']);

const populateCommunityThreads = (query) => query
  .populate('createdBy', 'name email role avatar')
  .populate('replies.author', 'name email role avatar');

const roundAmount = (value = 0) => Math.round(Number(value || 0) * 100) / 100;

const buildSummary = (bookings) => {
  const summary = bookings.reduce((acc, booking) => {
    const totalGuests = (booking.guests?.adults || 0) + (booking.guests?.children || 0);
    const bookingTotal = Number(booking.pricing?.totalPrice || 0);
    const refundAmount = Number(booking.refundAmount || 0);
    const paymentCompleted = COMPLETED_PAYMENT_STATUSES.has(booking.payment?.status);

    acc.totalBookings += 1;
    acc.totalGuests += totalGuests;

    if (paymentCompleted) {
      acc.completedPayments += 1;
      acc.grossRevenue += bookingTotal;
    }

    if (booking.status === 'pending') acc.pendingBookings += 1;
    if (['confirmed', 'checked-in', 'checked-out'].includes(booking.status)) acc.confirmedBookings += 1;
    if (['cancelled', 'no-show'].includes(booking.status)) acc.cancelledBookings += 1;

    acc.refundTotal += refundAmount;
    return acc;
  }, {
    totalBookings: 0,
    totalGuests: 0,
    completedPayments: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    cancelledBookings: 0,
    grossRevenue: 0,
    refundTotal: 0,
  });

  summary.grossRevenue = roundAmount(summary.grossRevenue);
  summary.refundTotal = roundAmount(summary.refundTotal);
  summary.netRevenue = roundAmount(summary.grossRevenue - summary.refundTotal);
  summary.averageBookingValue = summary.completedPayments > 0
    ? roundAmount(summary.grossRevenue / summary.completedPayments)
    : 0;

  return summary;
};

const buildBreakdown = (bookings, groupBy, dateField) => {
  const groups = new Map();

  bookings.forEach((booking) => {
    const paymentCompleted = COMPLETED_PAYMENT_STATUSES.has(booking.payment?.status);
    const bookingTotal = Number(booking.pricing?.totalPrice || 0);
    const refundAmount = Number(booking.refundAmount || 0);
    const guestCount = (booking.guests?.adults || 0) + (booking.guests?.children || 0);

    let key = 'other';
    let label = 'Other';
    let subLabel = '';
    let sortValue = 0;

    if (groupBy === 'hotel') {
      key = String(booking.hotel?._id || booking.hotel?.title || 'hotel');
      label = booking.hotel?.title || 'Hotel';
      subLabel = booking.hotel?.address?.city || '';
      sortValue = booking.createdAt ? new Date(booking.createdAt).getTime() : 0;
    } else if (groupBy === 'room') {
      key = String(booking.room?._id || `${booking.room?.title}-${booking.hotel?._id}`);
      label = booking.room?.title || 'Room';
      subLabel = booking.hotel?.title || '';
      sortValue = booking.createdAt ? new Date(booking.createdAt).getTime() : 0;
    } else if (groupBy === 'status') {
      key = booking.status || 'unknown';
      label = booking.status || 'unknown';
      sortValue = 0;
    } else {
      const reportDate = booking[dateField] ? new Date(booking[dateField]) : new Date();
      key = reportDate.toISOString().slice(0, 10);
      label = reportDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      subLabel = reportDate.toLocaleDateString('en-IN', { weekday: 'short' });
      sortValue = reportDate.getTime();
    }

    const current = groups.get(key) || {
      key,
      label,
      subLabel,
      bookings: 0,
      guests: 0,
      grossRevenue: 0,
      refunds: 0,
      netRevenue: 0,
      sortValue,
    };

    current.bookings += 1;
    current.guests += guestCount;
    if (paymentCompleted) {
      current.grossRevenue += bookingTotal;
    }
    current.refunds += refundAmount;
    current.netRevenue = current.grossRevenue - current.refunds;
    current.sortValue = groupBy === 'day' ? sortValue : Math.max(current.sortValue, sortValue);

    groups.set(key, current);
  });

  const rows = Array.from(groups.values()).map((row) => ({
    ...row,
    grossRevenue: roundAmount(row.grossRevenue),
    refunds: roundAmount(row.refunds),
    netRevenue: roundAmount(row.netRevenue),
  }));

  if (groupBy === 'day') {
    return rows.sort((a, b) => a.sortValue - b.sortValue);
  }

  return rows.sort((a, b) => {
    if (b.netRevenue !== a.netRevenue) return b.netRevenue - a.netRevenue;
    if (b.bookings !== a.bookings) return b.bookings - a.bookings;
    return a.label.localeCompare(b.label);
  });
};

const createComparison = (currentSummary, previousSummary) => ({
  previousSummary,
  delta: {
    totalBookings: currentSummary.totalBookings - previousSummary.totalBookings,
    completedPayments: currentSummary.completedPayments - previousSummary.completedPayments,
    grossRevenue: roundAmount(currentSummary.grossRevenue - previousSummary.grossRevenue),
    netRevenue: roundAmount(currentSummary.netRevenue - previousSummary.netRevenue),
    refundTotal: roundAmount(currentSummary.refundTotal - previousSummary.refundTotal),
  },
});

const formatSqlBookingForReport = (booking) => ({
  status: booking.status,
  createdAt: booking.createdAt,
  checkIn: booking.checkIn ? new Date(booking.checkIn) : null,
  checkOut: booking.checkOut ? new Date(booking.checkOut) : null,
  guests: {
    adults: booking.adults || 0,
    children: booking.children || 0,
  },
  pricing: {
    totalPrice: Number(booking.totalAmount || 0),
  },
  refundAmount: Number(booking.refundAmount || 0),
  payment: {
    status: booking.paymentStatus,
  },
  hotel: {
    _id: booking.hotelMongoId,
    title: booking.hotelTitle,
    address: {
      city: booking.hotelCity,
    },
  },
  room: {
    _id: booking.roomMongoId,
    title: booking.roomTitle,
    type: booking.roomType,
  },
});

const notifyCommunityAudience = async (thread, sender, contextText) => {
  const audience = await User.find({
    _id: { $ne: sender._id },
    isActive: true,
    role: { $in: ['admin', 'owner', 'superadmin'] },
  })
    .select('_id role')
    .lean();

  await Promise.all(audience.map((recipient) => createNotification({
    userId: recipient._id,
    type: 'system',
    title: `${sender.name} posted in the admin hub`,
    message: contextText,
    link: `/admin/community?thread=${thread._id}`,
    metadata: { threadId: thread._id },
  })));
};

// @desc    Get owner dashboard summary
// @route   GET /api/v1/owner/dashboard
const getOwnerDashboard = asyncHandler(async (req, res) => {
  const hotelIds = await Hotel.find({ createdBy: req.user._id }).distinct('_id');

  const [totalHotels, totalBookings, upcomingBookings, activeOffers, openConversations, recentBookings, recentConversations, communityThreads, recentCommunityThreads] = await Promise.all([
    Hotel.countDocuments({ createdBy: req.user._id, isActive: true }),
    Booking.countDocuments({ hotel: { $in: hotelIds } }),
    Booking.countDocuments({
      hotel: { $in: hotelIds },
      status: { $in: ['pending', 'confirmed', 'checked-in'] },
    }),
    Coupon.countDocuments({
      hotel: { $in: hotelIds },
      isActive: true,
    }),
    SupportConversation.countDocuments({
      owner: req.user._id,
      status: 'open',
    }),
    Booking.find({ hotel: { $in: hotelIds } })
      .populate('hotel', 'title address.city')
      .populate('user', 'name email')
      .sort('-createdAt')
      .limit(6)
      .lean(),
    SupportConversation.find({
      owner: req.user._id,
      status: 'open',
    })
      .populate('hotel', 'title slug')
      .populate('user', 'name email')
      .sort('-lastMessageAt')
      .limit(5)
      .lean(),
    OwnerCommunityThread.countDocuments(),
    populateCommunityThreads(
      OwnerCommunityThread.find()
        .sort({ isPinned: -1, lastActivityAt: -1 })
        .limit(4)
    ).lean(),
  ]);

  res.status(200).json(new ApiResponse(200, {
    stats: {
      totalHotels,
      totalBookings,
      upcomingBookings,
      activeOffers,
      openConversations,
      communityThreads,
    },
    recentBookings,
    recentConversations: recentConversations.map((conversation) => ({
      ...conversation,
      latestMessage: conversation.messages?.[conversation.messages.length - 1] || null,
    })),
    recentCommunityThreads: recentCommunityThreads.map((thread) => ({
      ...thread,
      latestReply: thread.replies?.[thread.replies.length - 1] || null,
      replyCount: thread.replies?.length || 0,
    })),
  }));
});

// @desc    Get owner community threads
// @route   GET /api/v1/owner/community
const getCommunityThreads = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim();
  const category = req.query.category?.trim();
  const filters = {};

  if (category && category !== 'all') {
    if (!COMMUNITY_CATEGORIES.includes(category)) {
      throw new ApiError(400, 'Invalid community category');
    }
    filters.category = category;
  }

  if (search) {
    filters.$or = [
      { title: { $regex: search, $options: 'i' } },
      { body: { $regex: search, $options: 'i' } },
    ];
  }

  const threads = await populateCommunityThreads(
    OwnerCommunityThread.find(filters).sort({ isPinned: -1, lastActivityAt: -1 })
  ).lean();

  res.status(200).json(new ApiResponse(200, {
    threads: threads.map((thread) => ({
      ...thread,
      latestReply: thread.replies?.[thread.replies.length - 1] || null,
      replyCount: thread.replies?.length || 0,
    })),
    categories: COMMUNITY_CATEGORIES,
  }));
});

// @desc    Create owner community thread
// @route   POST /api/v1/owner/community
const createCommunityThread = asyncHandler(async (req, res) => {
  const title = req.body.title?.trim();
  const body = req.body.body?.trim();
  const category = req.body.category?.trim() || 'general';

  if (!title) throw new ApiError(400, 'Thread title is required');
  if (!body) throw new ApiError(400, 'Thread body is required');
  if (!COMMUNITY_CATEGORIES.includes(category)) throw new ApiError(400, 'Invalid community category');

  const thread = await OwnerCommunityThread.create({
    title,
    body,
    category,
    createdBy: req.user._id,
    lastActivityAt: new Date(),
  });

  const populatedThread = await populateCommunityThreads(
    OwnerCommunityThread.findById(thread._id)
  );

  await notifyCommunityAudience(populatedThread, req.user, title);

  res.status(201).json(new ApiResponse(201, {
    thread: {
      ...populatedThread.toObject(),
      latestReply: null,
      replyCount: 0,
    },
  }, 'Community thread created'));
});

// @desc    Reply to owner community thread
// @route   POST /api/v1/owner/community/:id/replies
const replyToCommunityThread = asyncHandler(async (req, res) => {
  const text = req.body.text?.trim();
  if (!text) {
    throw new ApiError(400, 'Reply text is required');
  }

  const thread = await OwnerCommunityThread.findById(req.params.id);
  if (!thread) {
    throw new ApiError(404, 'Community thread not found');
  }

  thread.replies.push({
    author: req.user._id,
    text,
  });
  thread.lastActivityAt = new Date();
  await thread.save();

  const populatedThread = await populateCommunityThreads(
    OwnerCommunityThread.findById(thread._id)
  );

  const recipientIds = new Set([String(populatedThread.createdBy?._id || populatedThread.createdBy)]);
  populatedThread.replies.forEach((reply) => {
    if (reply.author?._id) {
      recipientIds.add(String(reply.author._id));
    }
  });
  recipientIds.delete(String(req.user._id));

  await Promise.all(Array.from(recipientIds).map((recipientId) => createNotification({
    userId: recipientId,
    type: 'system',
    title: `${req.user.name} replied in the admin hub`,
    message: populatedThread.title,
    link: `/admin/community?thread=${populatedThread._id}`,
    metadata: { threadId: populatedThread._id },
  })));

  res.status(200).json(new ApiResponse(200, {
    thread: {
      ...populatedThread.toObject(),
      latestReply: populatedThread.replies?.[populatedThread.replies.length - 1] || null,
      replyCount: populatedThread.replies?.length || 0,
    },
  }, 'Reply posted'));
});

// @desc    Get owner monthly booking report
// @route   GET /api/v1/owner/reports/monthly
const getMonthlyBookingReport = asyncHandler(async (req, res) => {
  const now = new Date();
  const month = Math.min(Math.max(parseInt(req.query.month, 10) || now.getMonth() + 1, 1), 12);
  const year = Math.min(Math.max(parseInt(req.query.year, 10) || now.getFullYear(), 2020), 2100);
  const groupBy = ['day', 'hotel', 'room', 'status'].includes(req.query.groupBy) ? req.query.groupBy : 'day';
  const dateField = ['createdAt', 'checkIn', 'checkOut'].includes(req.query.dateField) ? req.query.dateField : 'createdAt';
  const status = req.query.status?.trim() || 'all';
  const includeCancelled = req.query.includeCancelled === 'true';
  const comparePrevious = req.query.comparePrevious !== 'false';
  const selectedHotelId = req.query.hotelId?.trim() || '';

  const ownedHotels = await Hotel.find({ isActive: true })
    .select('_id title address.city')
    .lean();

  const allowedHotelIds = ownedHotels.map((hotel) => String(hotel._id));
  let scopedHotelIds = ownedHotels.map((hotel) => hotel._id);

  if (selectedHotelId) {
    if (!allowedHotelIds.includes(selectedHotelId)) {
      throw new ApiError(403, 'You can only report on hotels you own');
    }
    scopedHotelIds = [selectedHotelId];
  }

  const buildQueryForRange = (start, end) => {
    const query = {
      hotel: { $in: scopedHotelIds },
      [dateField]: { $gte: start, $lt: end },
    };

    if (status !== 'all') {
      query.status = status;
    } else if (!includeCancelled) {
      query.status = { $nin: ['cancelled', 'no-show'] };
    }

    return query;
  };

  const currentRangeStart = new Date(year, month - 1, 1);
  const currentRangeEnd = new Date(year, month, 1);
  const previousRangeStart = new Date(year, month - 2, 1);
  const previousRangeEnd = new Date(year, month - 1, 1);

  const sqlMirrorCount = await SqlBooking.count();

  const buildSqlWhereForRange = (start, end) => {
    const where = {
      hotelMongoId: { [Op.in]: scopedHotelIds.map((id) => String(id)) },
      [dateField]: { [Op.gte]: start, [Op.lt]: end },
    };

    if (status !== 'all') {
      where.status = status;
    } else if (!includeCancelled) {
      where.status = { [Op.notIn]: ['cancelled', 'no-show'] };
    }

    return where;
  };

  const currentBookings = sqlMirrorCount > 0
    ? (await SqlBooking.findAll({
        where: buildSqlWhereForRange(currentRangeStart, currentRangeEnd),
        raw: true,
      })).map(formatSqlBookingForReport)
    : await Booking.find(buildQueryForRange(currentRangeStart, currentRangeEnd))
      .populate('hotel', 'title address.city')
      .populate('room', 'title type')
      .lean();

  const summary = buildSummary(currentBookings);
  const breakdown = buildBreakdown(currentBookings, groupBy, dateField);

  let comparison = null;
  if (comparePrevious) {
    const previousBookings = sqlMirrorCount > 0
      ? (await SqlBooking.findAll({
          where: buildSqlWhereForRange(previousRangeStart, previousRangeEnd),
          raw: true,
        })).map(formatSqlBookingForReport)
      : await Booking.find(buildQueryForRange(previousRangeStart, previousRangeEnd))
        .populate('hotel', 'title address.city')
        .populate('room', 'title type')
        .lean();

    comparison = {
      label: previousRangeStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
      ...createComparison(summary, buildSummary(previousBookings)),
    };
  }

  res.status(200).json(new ApiResponse(200, {
    filters: {
      month,
      year,
      groupBy,
      dateField,
      status,
      includeCancelled,
      comparePrevious,
      hotelId: selectedHotelId,
    },
    hotels: ownedHotels,
    summary,
    breakdown,
    comparison,
    categories: COMMUNITY_CATEGORIES,
  }));
});

module.exports = {
  getOwnerDashboard,
  getCommunityThreads,
  createCommunityThread,
  replyToCommunityThread,
  getMonthlyBookingReport,
};
