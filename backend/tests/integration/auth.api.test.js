const request = require('supertest');
require('../dbSetup');
const app = require('../../src/app');
const User = require('../../src/models/User');

describe('Auth API Integration Tests', () => {
  const testUser = {
    name: 'Integration Test User',
    email: 'integration@test.com',
    password: 'TestPass123!',
    phone: '9876543210',
  };

  const createVerifiedUser = async (overrides = {}) => User.create({
    ...testUser,
    isVerified: true,
    ...overrides,
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user and require email OTP verification', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresOtp).toBe(true);
      expect(res.body.data.email).toBe(testUser.email);
      expect(res.body.data.accessToken).toBeUndefined();

      const createdUser = await User.findOne({ email: testUser.email }).select('+emailOtpHash +emailOtpExpires');
      expect(createdUser).toBeTruthy();
      expect(createdUser.isVerified).toBe(false);
      expect(createdUser.emailOtpHash).toBeTruthy();
      expect(createdUser.emailOtpExpires).toBeTruthy();
    });

    it('should return 409 for duplicate email', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);

      const res = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already registered');
    });

    it('should return 400 for missing required fields', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@test.com' })
        .expect(400);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login a verified user with correct credentials', async () => {
      await createVerifiedUser();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe(testUser.email);
    });

    it('should ask an unverified user to verify OTP before continuing', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.requiresOtp).toBe(true);
      expect(res.body.data.accessToken).toBeUndefined();
    });

    it('should return 401 for wrong password', async () => {
      await createVerifiedUser();

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'WrongPassword123!' })
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/auth/verify-email-otp', () => {
    it('should verify OTP and sign the user in', async () => {
      await request(app).post('/api/v1/auth/register').send(testUser);
      const user = await User.findOne({ email: testUser.email });
      user.emailOtpHash = require('crypto').createHash('sha256').update('123456').digest('hex');
      user.emailOtpExpires = new Date(Date.now() + 5 * 60 * 1000);
      user.emailOtpPurpose = 'verify-email';
      await user.save({ validateBeforeSave: false });

      const res = await request(app)
        .post('/api/v1/auth/verify-email-otp')
        .send({ email: testUser.email, otp: '123456' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.isVerified).toBe(true);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      await createVerifiedUser();
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully with valid token', async () => {
      await createVerifiedUser();
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password });

      const token = loginRes.body.data.accessToken;

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Logged out');
    });
  });
});
