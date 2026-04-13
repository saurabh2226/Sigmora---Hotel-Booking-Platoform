const { getRazorpayClient, hasRazorpayConfig } = require('../config/razorpay');
const Payment = require('../models/Payment');
const { syncPaymentToSql } = require('./sqlMirrorService');

/**
 * Create a Razorpay order
 */
const createRazorpayOrder = async (amount, currency = 'INR', receipt = '') => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      throw new Error('Razorpay keys are not configured on the server');
    }

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay expects amount in paise
      currency,
      receipt,
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    };
  } catch (error) {
    throw new Error(`Razorpay error: ${error.message}`);
  }
};

/**
 * Verify Razorpay payment signature
 */
const verifyRazorpayPayment = (orderId, paymentId, signature) => {
  if (!hasRazorpayConfig()) {
    throw new Error('Razorpay keys are not configured on the server');
  }

  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  return expectedSignature === signature;
};

/**
 * Process refund via Razorpay
 */
const processRazorpayRefund = async (paymentId, amount = null) => {
  try {
    const razorpay = getRazorpayClient();
    if (!razorpay) {
      throw new Error('Razorpay keys are not configured on the server');
    }

    const refundParams = {};
    if (amount) {
      refundParams.amount = Math.round(amount * 100);
    }
    const refund = await razorpay.payments.refund(paymentId, refundParams);
    return { refundId: refund.id, status: refund.status };
  } catch (error) {
    throw new Error(`Razorpay refund error: ${error.message}`);
  }
};

/**
 * Record payment in database
 */
const recordPayment = async (paymentData) => {
  const payment = await Payment.findOneAndUpdate(
    { transactionId: paymentData.transactionId },
    paymentData,
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  );
  await syncPaymentToSql(payment);
  return payment;
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  processRazorpayRefund,
  recordPayment,
};
