const request = require('supertest');
require('../dbSetup');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('OWASP Security Coverage', () => {
  let userToken;

  beforeEach(async () => {
    await User.create({
      name: 'SecUser',
      email: 'sec@test.com',
      password: 'SecurePass123!',
      role: 'user',
      isVerified: true,
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'sec@test.com', password: 'SecurePass123!' })
      .expect(200);

    userToken = loginRes.body.data.accessToken;
  });

  describe('Broken Access Control', () => {
    it('should prevent unauthenticated access to protected routes', async () => {
      await request(app).get('/api/v1/auth/me').expect(401);
      await request(app).get('/api/v1/bookings/my-bookings').expect(401);
      await request(app).post('/api/v1/auth/logout').expect(401);
    });

    it('should prevent non-admin access to admin routes', async () => {
      const res = await request(app)
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Cryptographic Failures', () => {
    it('should never return password in user responses', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.user.refreshToken).toBeUndefined();
    });

    it('should store passwords as bcrypt hashes', async () => {
      const user = await User.findOne({ email: 'sec@test.com' }).select('+password');
      expect(user.password).not.toBe('SecurePass123!');
      expect(user.password.startsWith('$2')).toBe(true);
    });
  });

  describe('Injection', () => {
    it('should sanitize NoSQL injection in auth inputs', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: { $gt: '' },
          password: { $gt: '' },
        });

      expect(res.body.data?.accessToken).toBeUndefined();
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Validation Hardening', () => {
    it('should reject invalid registration payloads', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({
          name: 'A',
          email: 'not-an-email',
          password: 'weak',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Security Misconfiguration', () => {
    it('should set helmet headers', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBeDefined();
      expect(res.headers['content-security-policy']).toBeDefined();
    });

    it('should not expose x-powered-by', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('JWT Security', () => {
    it('should reject invalid JWT tokens', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('Rate Limiting and Monitoring', () => {
    it('should expose a health endpoint', async () => {
      const res = await request(app)
        .get('/api/health')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.timestamp).toBeDefined();
    });
  });
});
