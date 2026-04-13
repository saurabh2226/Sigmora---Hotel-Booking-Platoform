const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { sendAdminCreatedCredentialsEmail, sendUserStatusChangedEmail } = require('../services/emailService');
const { syncUserToSql, syncCouponToSql, deactivateCouponInSql } = require('../services/sqlMirrorService');
const { User: SqlUser, Hotel: SqlHotel, Booking: SqlBooking } = require('../models/sql');
const { normalizeRole } = require('../middleware/roles');

const runSideEffect = (task) => {
  Promise.resolve()
    .then(task)
    .catch(console.error);
};

const generateTemporaryPassword = () => {
  const charsByGroup = {
    lower: 'abcdefghjkmnpqrstuvwxyz',
    upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    number: '23456789',
    symbol: '!@#$%^&*',
  };

  const groups = Object.values(charsByGroup);
  const passwordChars = groups.map((group) => group[crypto.randomInt(group.length)]);
  const allChars = groups.join('');

  while (passwordChars.length < 12) {
    passwordChars.push(allChars[crypto.randomInt(allChars.length)]);
  }

  for (let index = passwordChars.length - 1; index > 0; index -= 1) {
    const swapIndex = crypto.randomInt(index + 1);
    [passwordChars[index], passwordChars[swapIndex]] = [passwordChars[swapIndex], passwordChars[index]];
  }

  return passwordChars.join('');
};

const roundAmount = (value = 0) => Math.round(Number(value || 0) * 100) / 100;

const buildSqlRevenueRows = (bookings) => {
  const rows = new Map();

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const key = date.toISOString().slice(0, 10);
    const current = rows.get(key) || { _id: key, revenue: 0, bookings: 0 };

    current.revenue += Number(booking.totalAmount || 0);
    current.bookings += 1;
    rows.set(key, current);
  });

  return Array.from(rows.values())
    .map((row) => ({ ...row, revenue: roundAmount(row.revenue) }))
    .sort((a, b) => a._id.localeCompare(b._id));
};

const buildSqlMonthlyRevenueRows = (bookings) => {
  const rows = new Map();

  bookings.forEach((booking) => {
    const date = new Date(booking.createdAt);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const key = `${year}-${String(month).padStart(2, '0')}`;
    const current = rows.get(key) || { year, month, revenue: 0, count: 0 };

    current.revenue += Number(booking.totalAmount || 0);
    current.count += 1;
    rows.set(key, current);
  });

  return Array.from(rows.values())
    .map((row) => ({
      _id: { year: row.year, month: row.month },
      revenue: roundAmount(row.revenue),
      count: row.count,
    }))
    .sort((a, b) => (a._id.year - b._id.year) || (a._id.month - b._id.month));
};

const buildSqlStatusTrends = (bookings) => {
  const rows = new Map();

  bookings.forEach((booking) => {
    const key = booking.status || 'unknown';
    rows.set(key, (rows.get(key) || 0) + 1);
  });

  return Array.from(rows.entries()).map(([status, count]) => ({
    _id: status,
    count,
  }));
};

const formatSqlRecentBooking = (booking) => ({
  _id: booking.mongoId || booking.id,
  status: booking.status,
  createdAt: booking.createdAt,
  payment: {
    status: booking.paymentStatus,
  },
  pricing: {
    totalPrice: Number(booking.totalAmount || 0),
  },
  user: {
    name: booking.userName,
    email: booking.userEmail,
  },
  hotel: {
    title: booking.hotelTitle,
  },
});

// @desc    Get admin dashboard stats
// @route   GET /api/v1/admin/dashboard
const getDashboardStats = asyncHandler(async (req, res) => {
  const sqlBookingCount = await SqlBooking.count();
  if (sqlBookingCount > 0) {
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const [totalUsers, totalHotels, totalBookings, completedBookings, recentBookings, monthlyBookingRows] = await Promise.all([
      SqlUser.count({ where: { role: 'user' } }),
      SqlHotel.count({ where: { status: 'active' } }),
      SqlBooking.count(),
      SqlBooking.findAll({
        where: { paymentStatus: 'completed' },
        raw: true,
      }),
      SqlBooking.findAll({
        order: [['createdAt', 'DESC']],
        limit: 10,
        raw: true,
      }),
      SqlBooking.findAll({
        where: {
          paymentStatus: 'completed',
          createdAt: { [Op.gte]: twelveMonthsAgo },
        },
        raw: true,
      }),
    ]);

    return res.status(200).json(
      new ApiResponse(200, {
        stats: {
          totalUsers,
          totalHotels,
          totalBookings,
          totalRevenue: roundAmount(completedBookings.reduce((sum, booking) => sum + Number(booking.totalAmount || 0), 0)),
        },
        monthlyRevenue: buildSqlMonthlyRevenueRows(monthlyBookingRows),
        recentBookings: recentBookings.map(formatSqlRecentBooking),
      })
    );
  }

  const [totalUsers, totalHotels, totalBookings, revenueResult, recentBookings] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Hotel.countDocuments({ isActive: true }),
    Booking.countDocuments(),
    Booking.aggregate([
      { $match: { 'payment.status': 'completed' } },
      { $group: { _id: null, total: { $sum: '$pricing.totalPrice' } } },
    ]),
    Booking.find()
      .populate('user', 'name email')
      .populate('hotel', 'title')
      .sort('-createdAt')
      .limit(10)
      .lean(),
  ]);

  // Monthly revenue for chart (last 12 months)
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const monthlyRevenue = await Booking.aggregate([
    {
      $match: {
        'payment.status': 'completed',
        createdAt: { $gte: twelveMonthsAgo },
      },
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
        },
        revenue: { $sum: '$pricing.totalPrice' },
        count: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      stats: {
        totalUsers,
        totalHotels,
        totalBookings,
        totalRevenue: revenueResult[0]?.total || 0,
      },
      monthlyRevenue,
      recentBookings,
    })
  );
});

// @desc    Get all users (admin)
// @route   GET /api/v1/admin/users
const getUsers = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search, role, status } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }
  if (role === 'admin') {
    query.role = { $in: ['admin', 'owner', 'superadmin'] };
  } else if (role) {
    query.role = role;
  }
  if (status === 'active') query.isActive = true;
  if (status === 'inactive') query.isActive = false;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const [users, total] = await Promise.all([
    User.find(query)
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(query),
  ]);

  const userIds = users.map((user) => user._id);
  const reviews = userIds.length > 0
    ? await Review.find({ user: { $in: userIds } })
      .populate('hotel', 'title')
      .select('user hotel rating title comment createdAt')
      .sort({ createdAt: -1 })
      .lean()
    : [];

  const reviewsByUser = reviews.reduce((map, review) => {
    const userId = String(review.user);

    if (!map[userId]) {
      map[userId] = {
        reviewCount: 0,
        recentReviews: [],
      };
    }

    map[userId].reviewCount += 1;

    if (map[userId].recentReviews.length < 2) {
      map[userId].recentReviews.push(review);
    }

    return map;
  }, {});

  res.status(200).json(
    new ApiResponse(200, {
      users: users.map((user) => ({
        ...user,
        role: normalizeRole(user.role),
        reviewCount: reviewsByUser[String(user._id)]?.reviewCount || 0,
        recentReviews: reviewsByUser[String(user._id)]?.recentReviews || [],
      })),
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Create user (admin)
// @route   POST /api/v1/admin/users
const createUser = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    role = 'user',
    phone = '',
    password,
  } = req.body;

  if (!['user', 'admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  const plainPassword = password?.trim() || generateTemporaryPassword();

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password: plainPassword,
    phone: phone?.trim() || '',
    role,
    isVerified: true,
    provider: 'local',
  });
  await syncUserToSql(user);

  sendAdminCreatedCredentialsEmail({
    user,
    plainPassword,
    createdBy: req.user,
  }).catch(console.error);

  res.status(201).json(new ApiResponse(201, {
    user,
    credentials: {
      email: user.email,
      password: plainPassword,
    },
  }, 'User created and login credentials shared'));
});

// @desc    Change user role
// @route   PUT /api/v1/admin/users/:id/role
const changeUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!['user', 'admin'].includes(role)) {
    throw new ApiError(400, 'Invalid role');
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true }
  );

  if (!user) throw new ApiError(404, 'User not found');
  await syncUserToSql(user);

  res.status(200).json(new ApiResponse(200, { user }, 'Role updated'));
});

// @desc    Activate/deactivate user
// @route   PUT /api/v1/admin/users/:id/status
const changeUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true }
  );

  if (!user) throw new ApiError(404, 'User not found');
  await syncUserToSql(user);
  runSideEffect(() => sendUserStatusChangedEmail({
    user,
    isActive: user.isActive,
    changedBy: req.user,
  }));

  res.status(200).json(new ApiResponse(200, { user }, `User ${isActive ? 'activated' : 'deactivated'}`));
});

// @desc    Get revenue analytics
// @route   GET /api/v1/admin/analytics/revenue
const getRevenueAnalytics = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const sqlBookingCount = await SqlBooking.count();
  if (sqlBookingCount > 0) {
    const where = { paymentStatus: 'completed' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt[Op.gte] = new Date(startDate);
      if (endDate) where.createdAt[Op.lte] = new Date(endDate);
    }

    const rows = await SqlBooking.findAll({ where, raw: true });
    return res.status(200).json(new ApiResponse(200, {
      revenue: buildSqlRevenueRows(rows),
    }));
  }

  const match = { 'payment.status': 'completed' };
  if (startDate) match.createdAt = { $gte: new Date(startDate) };
  if (endDate) match.createdAt = { ...match.createdAt, $lte: new Date(endDate) };

  const revenue = await Booking.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$pricing.totalPrice' },
        bookings: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json(new ApiResponse(200, { revenue }));
});

// @desc    Get booking trends
// @route   GET /api/v1/admin/analytics/bookings
const getBookingAnalytics = asyncHandler(async (req, res) => {
  const sqlBookingCount = await SqlBooking.count();
  if (sqlBookingCount > 0) {
    const rows = await SqlBooking.findAll({ raw: true });
    return res.status(200).json(new ApiResponse(200, {
      trends: buildSqlStatusTrends(rows),
    }));
  }

  const trends = await Booking.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  res.status(200).json(new ApiResponse(200, { trends }));
});

// @desc    Get all reviews (admin)
// @route   GET /api/v1/admin/reviews
const getReviews = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    responded,
  } = req.query;

  const filters = [];

  if (search) {
    filters.push({
      $or: [
      { title: { $regex: search, $options: 'i' } },
      { comment: { $regex: search, $options: 'i' } },
      ],
    });
  }

  if (responded === 'yes') {
    filters.push({ 'response.text': { $exists: true, $ne: '' } });
  } else if (responded === 'no') {
    filters.push({
      $or: [
        { 'response.text': { $exists: false } },
        { 'response.text': '' },
      ],
    });
  }

  const query = filters.length > 0 ? { $and: filters } : {};

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const [reviews, total] = await Promise.all([
    Review.find(query)
      .populate('user', 'name email avatar')
      .populate('hotel', 'title address.city rating')
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Review.countDocuments(query),
  ]);

  res.status(200).json(new ApiResponse(200, {
    reviews,
    currentPage: pageNum,
    totalPages: Math.ceil(total / limitNum),
    totalResults: total,
  }));
});

// @desc    Get coupons
// @route   GET /api/v1/admin/coupons
const getCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find()
    .populate('hotel', 'title address.city')
    .populate('createdBy', 'name email role')
    .sort({ priority: -1, createdAt: -1 })
    .lean();
  res.status(200).json(new ApiResponse(200, { coupons }));
});

// @desc    Create coupon
// @route   POST /api/v1/admin/coupons
const createCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.create({
    ...req.body,
    createdBy: req.user._id,
  });
  await syncCouponToSql(coupon);
  res.status(201).json(new ApiResponse(201, { coupon }, 'Coupon created'));
});

// @desc    Update coupon
// @route   PUT /api/v1/admin/coupons/:id
const updateCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');

  Object.assign(coupon, req.body);
  await coupon.save();
  await syncCouponToSql(coupon);

  res.status(200).json(new ApiResponse(200, { coupon }, 'Coupon updated'));
});

// @desc    Delete coupon
// @route   DELETE /api/v1/admin/coupons/:id
const deleteCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findByIdAndDelete(req.params.id);
  if (!coupon) throw new ApiError(404, 'Coupon not found');
  await deactivateCouponInSql(coupon._id);
  res.status(200).json(new ApiResponse(200, null, 'Coupon deleted'));
});

module.exports = {
  getDashboardStats,
  createUser,
  getUsers,
  changeUserRole,
  changeUserStatus,
  getRevenueAnalytics,
  getBookingAnalytics,
  getReviews,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
};
