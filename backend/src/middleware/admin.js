const ApiError = require('../utils/ApiError');
const { isAdminRole } = require('./roles');

const admin = (req, res, next) => {
  if (!req.user) {
    throw new ApiError(401, 'Authentication required.');
  }

  if (!isAdminRole(req.user.role)) {
    throw new ApiError(403, 'Admin access required.');
  }

  next();
};

const superadmin = admin;

module.exports = { admin, superadmin };
