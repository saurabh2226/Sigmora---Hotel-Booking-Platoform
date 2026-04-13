const { calculateDynamicPricing } = require('../../../src/services/pricingService');

describe('pricingService', () => {
  it('applies weekend pricing uplift', () => {
    const pricing = calculateDynamicPricing({
      baseRate: 1000,
      checkIn: '2026-04-17',
      checkOut: '2026-04-19',
    });

    expect(pricing.numberOfNights).toBe(2);
    expect(pricing.subtotal).toBeGreaterThan(2000);
    expect(pricing.weekendNights).toBeGreaterThan(0);
  });

  it('applies coupon discounts on the subtotal', () => {
    const coupon = {
      calculateDiscount: jest.fn().mockReturnValue(500),
    };

    const pricing = calculateDynamicPricing({
      baseRate: 2000,
      checkIn: '2026-04-20',
      checkOut: '2026-04-22',
      coupon,
    });

    expect(coupon.calculateDiscount).toHaveBeenCalled();
    expect(pricing.discount).toBe(500);
    expect(pricing.totalPrice).toBeGreaterThan(0);
  });
});
