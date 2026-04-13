const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { allowRoles } = require('../middleware/roles');
const {
  getOwnerDashboard,
  getCommunityThreads,
  createCommunityThread,
  replyToCommunityThread,
  getMonthlyBookingReport,
} = require('../controllers/ownerController');
const { getOwnerBookings, updateBookingStatus } = require('../controllers/bookingController');

router.use(auth);

router.get('/dashboard', allowRoles('owner'), getOwnerDashboard);
router.get('/bookings', allowRoles('owner'), getOwnerBookings);
router.put('/bookings/:id/status', allowRoles('owner'), updateBookingStatus);
router.get('/reports/monthly', allowRoles('owner'), getMonthlyBookingReport);
router.get('/community', allowRoles('owner', 'admin', 'superadmin'), getCommunityThreads);
router.post('/community', allowRoles('owner', 'admin', 'superadmin'), createCommunityThread);
router.post('/community/:id/replies', allowRoles('owner', 'admin', 'superadmin'), replyToCommunityThread);

module.exports = router;
