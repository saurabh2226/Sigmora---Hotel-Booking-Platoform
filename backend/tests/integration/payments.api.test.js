const crypto = require('crypto');
const request = require('supertest');
require('../dbSetup');
const app = require('../../src/app');

describe('Payments API Integration Tests', () => {
  describe('POST /api/v1/payments/webhook', () => {
    it('accepts a valid Razorpay webhook signature', async () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_123',
            },
          },
        },
      });

      const signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest('hex');

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .send(rawPayload)
        .expect(200);

      expect(res.body.received).toBe(true);
    });

    it('rejects an invalid Razorpay webhook signature', async () => {
      const rawPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_456',
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', 'invalid_signature')
        .send(rawPayload)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid webhook signature');
    });
  });
});
