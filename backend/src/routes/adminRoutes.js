const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const validate = require('../middleware/validate');
const { createCouponValidation, adminCreateUserValidation } = require('../utils/validators');
const {
  getDashboardStats, createUser, getUsers, changeUserRole, changeUserStatus,
  getRevenueAnalytics, getBookingAnalytics, getReviews, getCoupons, createCoupon,
  updateCoupon, deleteCoupon,
} = require('../controllers/adminController');
const {
  getCommunityThreads,
  createCommunityThread,
  replyToCommunityThread,
  getMonthlyBookingReport,
} = require('../controllers/ownerController');

// All admin routes require auth + admin
router.use(auth, admin);

router.get('/dashboard', getDashboardStats);
router.post('/users', adminCreateUserValidation, validate, createUser);
router.get('/users', getUsers);
router.put('/users/:id/role', changeUserRole);
router.put('/users/:id/status', changeUserStatus);
router.get('/analytics/revenue', getRevenueAnalytics);
router.get('/analytics/bookings', getBookingAnalytics);
router.get('/community', getCommunityThreads);
router.post('/community', createCommunityThread);
router.post('/community/:id/replies', replyToCommunityThread);
router.get('/reports/monthly', getMonthlyBookingReport);
router.get('/reviews', getReviews);
router.get('/coupons', getCoupons);
router.post('/coupons', createCouponValidation, validate, createCoupon);
router.put('/coupons/:id', updateCoupon);
router.delete('/coupons/:id', deleteCoupon);

module.exports = router;
