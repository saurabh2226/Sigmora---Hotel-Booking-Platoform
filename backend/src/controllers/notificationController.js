const Notification = require('../models/Notification');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { syncNotificationsForUserToSql } = require('../services/sqlMirrorService');

// @desc    Get user notifications
// @route   GET /api/v1/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const { isRead, page = 1, limit = 20 } = req.query;

  const query = { user: req.user._id };
  if (isRead !== undefined) query.isRead = isRead === 'true';

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  const [notifications, total] = await Promise.all([
    Notification.find(query)
      .sort('-createdAt')
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Notification.countDocuments(query),
  ]);

  res.status(200).json(
    new ApiResponse(200, {
      notifications,
      currentPage: pageNum,
      totalPages: Math.ceil(total / limitNum),
      totalResults: total,
    })
  );
});

// @desc    Mark notification as read
// @route   PUT /api/v1/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { isRead: true }
  );
  await syncNotificationsForUserToSql(req.user._id);
  res.status(200).json(new ApiResponse(200, null, 'Marked as read'));
});

// @desc    Mark all notifications as read
// @route   PUT /api/v1/notifications/read-all
const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { isRead: true }
  );
  await syncNotificationsForUserToSql(req.user._id);
  res.status(200).json(new ApiResponse(200, null, 'All marked as read'));
});

// @desc    Get unread count
// @route   GET /api/v1/notifications/unread-count
const getUnreadCount = asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.user._id, isRead: false });
  res.status(200).json(new ApiResponse(200, { count }));
});

module.exports = { getNotifications, markAsRead, markAllAsRead, getUnreadCount };
