const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const { bookingWriteLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const { createBookingValidation } = require('../utils/validators');
const {
  createBooking, getMyBookings, getBooking, cancelBooking,
  getAllBookings, updateBookingStatus,
} = require('../controllers/bookingController');

router.post('/', auth, bookingWriteLimiter, createBookingValidation, validate, createBooking);
router.get('/my-bookings', auth, getMyBookings);
router.get('/:id', auth, getBooking);
router.put('/:id/cancel', auth, bookingWriteLimiter, cancelBooking);

// Admin routes
router.get('/', auth, admin, getAllBookings);
router.put('/:id/status', auth, admin, bookingWriteLimiter, updateBookingStatus);

module.exports = router;
