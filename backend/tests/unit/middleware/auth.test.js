const jwt = require('jsonwebtoken');

// Mock the User model
jest.mock('../../../src/models/User', () => {
  const mockFindById = jest.fn();
  return {
    findById: mockFindById,
  };
});

const User = require('../../../src/models/User');

// We need to test the middleware functions directly
// Import after mocking
const { auth, optionalAuth } = require('../../../src/middleware/auth');

// asyncHandler doesn't return the inner promise — flush microtasks after calling
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// Helper to create mock req, res, next
const createMocks = (authHeader) => {
  const req = {
    headers: {},
  };
  if (authHeader) {
    req.headers.authorization = authHeader;
  }
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_key_for_testing';
  });

  describe('auth', () => {
    it('should reject if no token is provided', async () => {
      const { req, res, next } = createMocks();

      auth(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Access denied. No token provided.');
    });

    it('should reject if token is invalid', async () => {
      const { req, res, next } = createMocks('Bearer invalidtoken');

      auth(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should reject if user not found in DB', async () => {
      const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_ACCESS_SECRET);
      const { req, res, next } = createMocks(`Bearer ${token}`);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      auth(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('User not found.');
    });

    it('should reject if user account is deactivated', async () => {
      const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_ACCESS_SECRET);
      const { req, res, next } = createMocks(`Bearer ${token}`);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: '507f1f77bcf86cd799439011', isActive: false }),
      });

      auth(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Account has been deactivated.');
    });

    it('should set req.user and call next on valid token', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', name: 'Test', isActive: true };
      const token = jwt.sign({ id: mockUser._id }, process.env.JWT_ACCESS_SECRET);
      const { req, res, next } = createMocks(`Bearer ${token}`);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      auth(req, res, next);
      await flushPromises();

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalledWith(); // called with no arguments = success
    });

    it('should reject expired token', async () => {
      const token = jwt.sign({ id: '507f1f77bcf86cd799439011' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '0s' });

      // Wait a moment for token to expire
      await new Promise((r) => setTimeout(r, 50));

      const { req, res, next } = createMocks(`Bearer ${token}`);

      auth(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
      expect(error.message).toBe('Token expired.');
    });
  });

  describe('optionalAuth', () => {
    it('should call next without setting user if no token', async () => {
      const { req, res, next } = createMocks();

      optionalAuth(req, res, next);
      await flushPromises();

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });

    it('should set user if valid token provided', async () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', name: 'Test', isActive: true };
      const token = jwt.sign({ id: mockUser._id }, process.env.JWT_ACCESS_SECRET);
      const { req, res, next } = createMocks(`Bearer ${token}`);

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      optionalAuth(req, res, next);
      await flushPromises();

      expect(req.user).toEqual(mockUser);
      expect(next).toHaveBeenCalled();
    });

    it('should silently ignore invalid token and call next', async () => {
      const { req, res, next } = createMocks('Bearer invalidtoken');

      optionalAuth(req, res, next);
      await flushPromises();

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalled();
    });
  });
});
