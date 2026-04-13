const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { admin } = require('../middleware/admin');
const { paymentLimiter } = require('../middleware/rateLimiter');
const {
  createRazorpayPaymentOrder,
  verifyRazorpayPaymentHandler,
  razorpayWebhook,
  markPaymentFailedAndReleaseHold,
  initiateRefund,
} = require('../controllers/paymentController');

router.post('/razorpay/create-order', auth, paymentLimiter, createRazorpayPaymentOrder);
router.post('/razorpay/verify', auth, paymentLimiter, verifyRazorpayPaymentHandler);
router.post('/razorpay/:bookingId/fail', auth, paymentLimiter, markPaymentFailedAndReleaseHold);
router.post('/create-order', auth, paymentLimiter, createRazorpayPaymentOrder);
router.post('/verify', auth, paymentLimiter, verifyRazorpayPaymentHandler);
router.post('/:bookingId/fail', auth, paymentLimiter, markPaymentFailedAndReleaseHold);
router.post('/webhook/razorpay', razorpayWebhook);
router.post('/webhook', razorpayWebhook);

// Admin
router.post('/:bookingId/refund', auth, admin, paymentLimiter, initiateRefund);

module.exports = router;
