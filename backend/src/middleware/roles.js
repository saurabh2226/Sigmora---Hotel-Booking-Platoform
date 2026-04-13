const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

const normalizeRole = (role) => {
  if (role === 'owner' || role === 'superadmin') {
    return 'admin';
  }

  return role || 'user';
};

const ADMIN_ROLES = ['admin'];
const HOTEL_MANAGER_ROLES = ['admin'];

const isAdminRole = (role) => normalizeRole(role) === 'admin';
const isOwnerRole = () => false;

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const allowedRoles = roles.map((role) => normalizeRole(role));
  if (!allowedRoles.includes(normalizeRole(req.user.role))) {
    throw new ApiError(403, 'You do not have permission to access this resource.');
  }

  next();
};

const hotelManager = allowRoles(...HOTEL_MANAGER_ROLES);

const requireHotelManagementAccess = (hotelParam = 'id') => asyncHandler(async (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  const hotel = await Hotel.findById(req.params[hotelParam]);
  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  if (!isAdminRole(req.user.role) && hotel.createdBy.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You can only manage hotels that belong to you.');
  }

  req.managedHotel = hotel;
  next();
});

module.exports = {
  ADMIN_ROLES,
  HOTEL_MANAGER_ROLES,
  normalizeRole,
  isAdminRole,
  isOwnerRole,
  allowRoles,
  hotelManager,
  requireHotelManagementAccess,
};
