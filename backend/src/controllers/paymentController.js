const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const {
  sendBookingConfirmationEmail,
  sendBookingPaymentFailedEmail,
  sendOwnerBookingAlertEmail,
  sendRefundIssuedEmail,
} = require('../services/emailService');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  processRazorpayRefund,
  recordPayment,
} = require('../services/paymentService');
const {
  confirmRoomInventoryForBooking,
  expireSinglePendingBooking,
  expireStalePendingBookings,
  getHoldExpiryDate,
  isHoldActive,
  releaseRoomHoldForBooking,
} = require('../services/bookingLifecycleService');
const { emitAvailabilityUpdate } = require('../socket/socketHandler');
const { syncBookingToSql } = require('../services/sqlMirrorService');

const runSideEffect = (task) => {
  Promise.resolve()
    .then(task)
    .catch(console.error);
};

const populateBookingEmailContext = async (booking) => booking.populate([
  { path: 'user', select: 'name email phone' },
  {
    path: 'hotel',
    select: 'title slug address createdBy',
    populate: { path: 'createdBy', select: 'name email role' },
  },
  { path: 'room', select: 'title type' },
]);

// @desc    Create Razorpay order
// @route   POST /api/v1/payments/razorpay/create-order
const createRazorpayPaymentOrder = asyncHandler(async (req, res) => {
  const { bookingId } = req.body;
  await expireStalePendingBookings();

  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(500, 'Razorpay keys are not configured on the server');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (booking.payment.status === 'completed') {
    return res.status(200).json(
      new ApiResponse(200, { booking }, 'Booking is already paid')
    );
  }

  if (booking.status === 'cancelled') {
    throw new ApiError(409, 'This booking is no longer active. Please create a new booking.');
  }

  if (booking.status === 'pending' && !isHoldActive(booking)) {
    await expireSinglePendingBooking(booking);
    throw new ApiError(409, 'Your room hold has expired. Please rebook to continue.');
  }

  const { orderId, amount, currency } = await createRazorpayOrder(
    booking.pricing.totalPrice,
    'INR',
    `booking_${booking._id}`
  );

  booking.payment.method = 'razorpay';
  booking.payment.transactionId = orderId;
  booking.holdExpiresAt = getHoldExpiryDate();
  await booking.save();
  await syncBookingToSql(booking);

  emitAvailabilityUpdate(booking.hotel, {
    roomId: booking.room,
    action: 'hold-extended',
    holdExpiresAt: booking.holdExpiresAt,
  });

  res.status(200).json(
    new ApiResponse(200, {
      orderId,
      amount,
      currency,
      key: process.env.RAZORPAY_KEY_ID,
      holdExpiresAt: booking.holdExpiresAt,
    }, 'Razorpay order created')
  );
});

// @desc    Verify Razorpay payment
// @route   POST /api/v1/payments/razorpay/verify
const verifyRazorpayPaymentHandler = asyncHandler(async (req, res) => {
  const { orderId, paymentId, signature, bookingId } = req.body;
  await expireStalePendingBookings();

  const isValid = verifyRazorpayPayment(orderId, paymentId, signature);
  if (!isValid) {
    throw new ApiError(400, 'Invalid payment signature');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (booking.payment.status === 'completed') {
    return res.status(200).json(
      new ApiResponse(200, { booking }, 'Payment already verified')
    );
  }

  if (booking.status === 'cancelled') {
    throw new ApiError(409, 'Booking was cancelled before payment confirmation');
  }

  if (booking.status === 'pending' && !isHoldActive(booking)) {
    await expireSinglePendingBooking(booking);
    throw new ApiError(409, 'Your room hold expired during checkout. Please rebook and try again.');
  }

  try {
    await confirmRoomInventoryForBooking(booking);
  } catch (error) {
    if (error.message === 'INVENTORY_SYNC_FAILED') {
      throw new ApiError(409, 'This room hold is no longer available. Please create a new booking.');
    }
    throw error;
  }
  booking.payment.status = 'completed';
  booking.payment.transactionId = paymentId;
  booking.payment.paidAt = new Date();
  booking.status = 'confirmed';
  booking.holdExpiresAt = null;
  await booking.save();
  await syncBookingToSql(booking);

  // Record payment
  await recordPayment({
    booking: booking._id,
    user: booking.user,
    amount: booking.pricing.totalPrice,
    currency: 'INR',
    method: 'razorpay',
    transactionId: paymentId,
    status: 'completed',
    gatewayResponse: { orderId, paymentId, signature },
  });

  emitAvailabilityUpdate(booking.hotel, {
    roomId: booking.room,
    action: 'confirmed',
  });

  runSideEffect(async () => {
    const populatedBooking = await populateBookingEmailContext(booking);
    if (populatedBooking.user?.email) {
      await sendBookingConfirmationEmail(populatedBooking.user, populatedBooking, populatedBooking.hotel);
    }
    if (populatedBooking.hotel?.createdBy?.email) {
      await sendOwnerBookingAlertEmail({
        owner: populatedBooking.hotel.createdBy,
        guest: populatedBooking.user,
        booking: populatedBooking,
        hotel: populatedBooking.hotel,
        room: populatedBooking.room,
        action: 'confirmed',
      });
    }
  });

  res.status(200).json(
    new ApiResponse(200, { booking }, 'Payment verified and booking confirmed')
  );
});

// @desc    Razorpay webhook
// @route   POST /api/v1/payments/webhook/razorpay
const razorpayWebhook = asyncHandler(async (req, res) => {
  const crypto = require('crypto');
  const rawBody = req.rawBody || JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== req.headers['x-razorpay-signature']) {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  const { event, payload } = req.body;

  if (event === 'payment.captured') {
    const orderId = payload?.payment?.entity?.order_id;
    const paymentId = payload?.payment?.entity?.id;

    const booking = await Booking.findOne({
      'payment.transactionId': orderId,
      status: 'pending',
      'payment.status': 'pending',
    });

    if (booking) {
      if (isHoldActive(booking)) {
        try {
          await confirmRoomInventoryForBooking(booking);
        } catch (error) {
          if (error.message === 'INVENTORY_SYNC_FAILED') {
            await expireSinglePendingBooking(booking, 'Payment completed after the room hold became unavailable');
            return res.status(200).json({ received: true });
          }
          throw error;
        }
        booking.payment.status = 'completed';
        booking.payment.transactionId = paymentId;
        booking.payment.paidAt = new Date();
        booking.status = 'confirmed';
        booking.holdExpiresAt = null;
        await booking.save();
        await syncBookingToSql(booking);
        await recordPayment({
          booking: booking._id,
          user: booking.user,
          amount: booking.pricing.totalPrice,
          currency: 'INR',
          method: 'razorpay',
          transactionId: paymentId,
          status: 'completed',
          gatewayResponse: payload?.payment?.entity || { orderId, paymentId },
        });

        runSideEffect(async () => {
          const populatedBooking = await populateBookingEmailContext(booking);
          if (populatedBooking.user?.email) {
            await sendBookingConfirmationEmail(populatedBooking.user, populatedBooking, populatedBooking.hotel);
          }
          if (populatedBooking.hotel?.createdBy?.email) {
            await sendOwnerBookingAlertEmail({
              owner: populatedBooking.hotel.createdBy,
              guest: populatedBooking.user,
              booking: populatedBooking,
              hotel: populatedBooking.hotel,
              room: populatedBooking.room,
              action: 'confirmed',
            });
          }
        });
      } else {
        await expireSinglePendingBooking(booking);
      }
    }
  }

  res.status(200).json({ received: true });
});

// @desc    Mark payment failed and release pending room hold
// @route   POST /api/v1/payments/:bookingId/fail
const markPaymentFailedAndReleaseHold = asyncHandler(async (req, res) => {
  await expireStalePendingBookings();
  const booking = await Booking.findById(req.params.bookingId);

  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (booking.user.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'Not authorized');
  }

  if (booking.payment.status === 'completed') {
    throw new ApiError(400, 'Payment is already completed for this booking');
  }

  if (booking.status === 'pending') {
    await releaseRoomHoldForBooking(booking);
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || 'Payment failed before confirmation';
  booking.payment.status = 'failed';
  booking.holdExpiresAt = null;
  await booking.save();
  await syncBookingToSql(booking);

  emitAvailabilityUpdate(booking.hotel, {
    roomId: booking.room,
    action: 'freed',
  });

  runSideEffect(async () => {
    const populatedBooking = await populateBookingEmailContext(booking);
    if (populatedBooking.user?.email) {
      await sendBookingPaymentFailedEmail(populatedBooking.user, populatedBooking, populatedBooking.hotel);
    }
  });

  res.status(200).json(
    new ApiResponse(200, { booking }, 'Payment marked as failed and room released')
  );
});

// @desc    Initiate refund
// @route   POST /api/v1/payments/:bookingId/refund
const initiateRefund = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }

  if (!['completed', 'partial_refunded'].includes(booking.payment.status)) {
    throw new ApiError(400, 'Only completed or partially refunded payments can be refunded');
  }

  if (booking.payment.method !== 'razorpay') {
    throw new ApiError(400, 'Only Razorpay refunds are supported');
  }

  const totalPaid = Number(booking.pricing?.totalPrice || 0);
  const refundedSoFar = Number(booking.refundAmount || 0);
  const remainingRefundable = Math.max(0, totalPaid - refundedSoFar);

  if (remainingRefundable <= 0 || booking.payment.status === 'refunded') {
    throw new ApiError(400, 'This booking has already been fully refunded');
  }

  const requestedAmount = Number(req.body.amount || remainingRefundable);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw new ApiError(400, 'Refund amount must be greater than zero');
  }

  if (requestedAmount > remainingRefundable) {
    throw new ApiError(400, `Refund amount cannot exceed ${remainingRefundable}`);
  }

  const refundResult = await processRazorpayRefund(booking.payment.transactionId, requestedAmount);
  const totalRefunded = refundedSoFar + requestedAmount;

  booking.payment.status = totalRefunded < totalPaid ? 'partial_refunded' : 'refunded';
  booking.payment.refundId = refundResult.refundId;
  booking.payment.refundedAt = new Date();
  booking.refundAmount = totalRefunded;
  await booking.save();
  await syncBookingToSql(booking);
  await recordPayment({
    booking: booking._id,
    user: booking.user,
    amount: totalPaid,
    currency: 'INR',
    method: 'razorpay',
    transactionId: booking.payment.transactionId,
    status: booking.payment.status,
    gatewayResponse: {
      refundResult,
      requestedAmount,
      totalRefunded,
      note: req.body.note || '',
    },
    refundId: booking.payment.refundId,
    refundedAt: booking.payment.refundedAt,
  });

  runSideEffect(async () => {
    const populatedBooking = await populateBookingEmailContext(booking);
    if (populatedBooking.user?.email) {
      await sendRefundIssuedEmail(populatedBooking.user, populatedBooking, populatedBooking.hotel, requestedAmount);
    }
  });

  res.status(200).json(
    new ApiResponse(200, {
      refundResult,
      refundAmount: requestedAmount,
      totalRefunded,
      remainingRefundable: Math.max(0, totalPaid - totalRefunded),
    }, 'Refund initiated')
  );
});

module.exports = {
  createRazorpayPaymentOrder,
  verifyRazorpayPaymentHandler,
  razorpayWebhook,
  markPaymentFailedAndReleaseHold,
  initiateRefund,
};
