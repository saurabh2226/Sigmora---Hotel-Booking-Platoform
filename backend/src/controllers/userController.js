const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { syncUserToSql } = require('../services/sqlMirrorService');

// @desc    Get user profile by ID
// @route   GET /api/v1/users/:id
const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('name avatar createdAt');

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  res.status(200).json(new ApiResponse(200, { user }));
});

// @desc    Update user preferences
// @route   PUT /api/v1/users/preferences
const updatePreferences = asyncHandler(async (req, res) => {
  const { currency, notifications, theme } = req.body;
  const updates = {};

  if (currency) updates['preferences.currency'] = currency;
  if (notifications !== undefined) updates['preferences.notifications'] = notifications;
  if (theme) updates['preferences.theme'] = theme;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  await syncUserToSql(user);

  res.status(200).json(new ApiResponse(200, { user }, 'Preferences updated'));
});

// @desc    Delete user account
// @route   DELETE /api/v1/users/account
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { isActive: false }, { new: true });
  await syncUserToSql(user);

  res.clearCookie('refreshToken');

  res.status(200).json(new ApiResponse(200, null, 'Account deactivated successfully'));
});

module.exports = {
  getUserById,
  updatePreferences,
  deleteAccount,
};
