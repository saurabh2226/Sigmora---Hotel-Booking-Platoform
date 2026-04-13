const { roundCurrency } = require('./pricingService');

const getHoursUntilCheckIn = (checkIn, reference = new Date()) => (
  (new Date(checkIn) - reference) / (1000 * 60 * 60)
);

const getRefundDecision = (booking, reference = new Date()) => {
  const hoursUntilCheckIn = getHoursUntilCheckIn(booking.checkIn, reference);
  const totalPrice = booking.pricing?.totalPrice || 0;
  const policy = booking.hotel?.policies?.cancellation || 'moderate';

  if (booking.payment?.status !== 'completed') {
    return {
      policy,
      refundAmount: 0,
      refundPercentage: 0,
      summary: 'Booking cancelled before payment settlement. No refund is needed.',
    };
  }

  let refundPercentage = 0;

  if (policy === 'free') {
    if (hoursUntilCheckIn >= 72) refundPercentage = 100;
    else if (hoursUntilCheckIn >= 24) refundPercentage = 50;
  } else if (policy === 'strict') {
    if (hoursUntilCheckIn >= 168) refundPercentage = 50;
    else if (hoursUntilCheckIn >= 72) refundPercentage = 25;
  } else {
    if (hoursUntilCheckIn >= 168) refundPercentage = 80;
    else if (hoursUntilCheckIn >= 48) refundPercentage = 50;
    else if (hoursUntilCheckIn >= 24) refundPercentage = 25;
  }

  const refundAmount = roundCurrency((totalPrice * refundPercentage) / 100);

  return {
    policy,
    refundAmount,
    refundPercentage,
    summary: refundPercentage > 0
      ? `${refundPercentage}% refund applies under the ${policy} cancellation policy.`
      : `This booking is inside the non-refundable window for the ${policy} cancellation policy.`,
  };
};

module.exports = {
  getHoursUntilCheckIn,
  getRefundDecision,
};
