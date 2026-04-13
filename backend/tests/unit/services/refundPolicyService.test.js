const { getRefundDecision } = require('../../../src/services/refundPolicyService');

describe('refundPolicyService', () => {
  it('returns a 50% refund in the moderate mid-window', () => {
    const booking = {
      checkIn: '2026-05-10T12:00:00.000Z',
      pricing: { totalPrice: 10000 },
      payment: { status: 'completed' },
      hotel: {
        policies: {
          cancellation: 'moderate',
        },
      },
    };

    const decision = getRefundDecision(booking, new Date('2026-05-07T12:00:00.000Z'));

    expect(decision.refundPercentage).toBe(50);
    expect(decision.refundAmount).toBe(5000);
  });

  it('returns zero refund for unpaid bookings', () => {
    const booking = {
      checkIn: '2026-05-10T12:00:00.000Z',
      pricing: { totalPrice: 10000 },
      payment: { status: 'pending' },
      hotel: {
        policies: {
          cancellation: 'free',
        },
      },
    };

    const decision = getRefundDecision(booking, new Date('2026-05-01T12:00:00.000Z'));

    expect(decision.refundPercentage).toBe(0);
    expect(decision.refundAmount).toBe(0);
  });
});
