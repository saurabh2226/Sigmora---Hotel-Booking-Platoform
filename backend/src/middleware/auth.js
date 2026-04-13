const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { normalizeRole } = require('./roles');

const auth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      throw new ApiError(401, 'User not found.');
    }

    if (!user.isActive) {
      throw new ApiError(401, 'Account has been deactivated.');
    }

    user.role = normalizeRole(user.role);
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token.');
    }
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token expired.');
    }
    throw error;
  }
});

const optionalAuth = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('-password -refreshToken');
      if (user && user.isActive) {
        user.role = normalizeRole(user.role);
        req.user = user;
      }
    } catch (error) {
      // Silently ignore invalid tokens for optional auth
    }
  }

  next();
});

module.exports = { auth, optionalAuth };
