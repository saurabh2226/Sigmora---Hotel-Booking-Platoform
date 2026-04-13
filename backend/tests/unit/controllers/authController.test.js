// Mock dependencies before requiring the controller
jest.mock('../../../src/models/User');
jest.mock('../../../src/utils/generateToken');
jest.mock('../../../src/services/emailService');

const User = require('../../../src/models/User');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../../src/utils/generateToken');
const { sendVerificationEmail } = require('../../../src/services/emailService');

// Import controller functions
const {
  register, login, logout, refreshAccessToken, getMe, changePassword, googleAuth, googleCallback,
} = require('../../../src/controllers/authController');

// asyncHandler doesn't return the inner promise, so `await handler()` resolves
// immediately. We flush the microtask queue with setImmediate to let all
// chained awaits inside the controller complete before running assertions.
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

// Helper: create mock req/res/next
const createMocks = (body = {}, params = {}, cookies = {}, user = null) => {
  const req = {
    body,
    params,
    cookies,
    user,
    query: {},
    protocol: 'http',
    get: jest.fn().mockReturnValue('localhost:5000'),
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe('AuthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.CLIENT_URL = 'http://localhost:5173';
    process.env.GOOGLE_CLIENT_ID = 'google-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret';
    process.env.GOOGLE_CALLBACK_URL = 'http://localhost:5000/api/v1/auth/google/callback';
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockUser = {
        _id: 'user123',
        name: 'John Doe',
        email: 'john@example.com',
        refreshToken: '',
        lastLogin: null,
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({ _id: 'user123', name: 'John Doe', email: 'john@example.com' }),
      };

      User.findOne.mockResolvedValue(null); // no existing user
      User.create.mockResolvedValue(mockUser);
      generateAccessToken.mockReturnValue('access_token_123');
      generateRefreshToken.mockReturnValue('refresh_token_123');
      sendVerificationEmail.mockResolvedValue(true);

      const { req, res, next } = createMocks({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
        phone: '1234567890',
      });

      register(req, res, next);
      await flushPromises();

      expect(User.findOne).toHaveBeenCalledWith({ email: 'john@example.com' });
      expect(User.create).toHaveBeenCalled();
      expect(generateAccessToken).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh_token_123', expect.any(Object));
      expect(res.json).toHaveBeenCalled();
    });

    it('should throw 409 if email already exists', async () => {
      User.findOne.mockResolvedValue({ email: 'john@example.com' });

      const { req, res, next } = createMocks({
        name: 'John', email: 'john@example.com', password: 'Pass1234!',
      });

      register(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(409);
      expect(error.message).toBe('Email already registered');
    });
  });

  describe('login', () => {
    it('should login successfully with correct credentials', async () => {
      const mockUser = {
        _id: 'user123',
        email: 'john@example.com',
        isActive: true,
        refreshToken: '',
        lastLogin: null,
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({ _id: 'user123', email: 'john@example.com' }),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      generateAccessToken.mockReturnValue('access_token');
      generateRefreshToken.mockReturnValue('refresh_token');

      const { req, res, next } = createMocks({
        email: 'john@example.com',
        password: 'Password123!',
      });

      login(req, res, next);
      await flushPromises();

      expect(mockUser.comparePassword).toHaveBeenCalledWith('Password123!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it('should throw 401 if user not found', async () => {
      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const { req, res, next } = createMocks({
        email: 'none@example.com',
        password: 'Password123!',
      });

      login(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should throw 401 if password does not match', async () => {
      const mockUser = {
        _id: 'user123',
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const { req, res, next } = createMocks({
        email: 'john@example.com',
        password: 'WrongPassword',
      });

      login(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });

    it('should throw 401 if account is deactivated', async () => {
      const mockUser = {
        _id: 'user123',
        isActive: false,
      };

      User.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const { req, res, next } = createMocks({
        email: 'john@example.com',
        password: 'Password123!',
      });

      login(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(401);
    });
  });

  describe('logout', () => {
    it('should clear refresh token and cookie', async () => {
      User.findByIdAndUpdate.mockResolvedValue(true);

      const { req, res, next } = createMocks({}, {}, {}, { _id: 'user123' });

      logout(req, res, next);
      await flushPromises();

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user123', { refreshToken: '' });
      expect(res.clearCookie).toHaveBeenCalledWith('refreshToken');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getMe', () => {
    it('should return the current user', async () => {
      const mockUser = { _id: 'user123', name: 'John', email: 'john@example.com' };
      User.findById.mockResolvedValue(mockUser);

      const { req, res, next } = createMocks({}, {}, {}, { _id: 'user123' });

      getMe(req, res, next);
      await flushPromises();

      expect(User.findById).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const mockUser = {
        _id: 'user123',
        password: 'hashed_old',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue(true),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const { req, res, next } = createMocks(
        { currentPassword: 'OldPass123!', newPassword: 'NewPass123!' },
        {}, {}, { _id: 'user123' }
      );

      changePassword(req, res, next);
      await flushPromises();

      expect(mockUser.comparePassword).toHaveBeenCalledWith('OldPass123!');
      expect(mockUser.password).toBe('NewPass123!');
      expect(mockUser.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should throw 400 if current password is wrong', async () => {
      const mockUser = {
        _id: 'user123',
        comparePassword: jest.fn().mockResolvedValue(false),
      };

      User.findById.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });

      const { req, res, next } = createMocks(
        { currentPassword: 'WrongPass', newPassword: 'NewPass123!' },
        {}, {}, { _id: 'user123' }
      );

      changePassword(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });
  });

  describe('googleAuth', () => {
    it('should redirect to Google authorization URL and set OAuth cookies', async () => {
      const { req, res, next } = createMocks();
      req.query = { redirect: '/dashboard' };

      googleAuth(req, res, next);
      await flushPromises();

      expect(res.cookie).toHaveBeenCalledWith('google_oauth_state', expect.any(String), expect.any(Object));
      expect(res.cookie).toHaveBeenCalledWith('google_oauth_redirect', '/dashboard', expect.any(Object));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('https://accounts.google.com/o/oauth2/v2/auth'));
      expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('client_id=google-client-id'));
    });
  });

  describe('googleCallback', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should complete Google OAuth login and redirect back to the frontend', async () => {
      const mockUser = {
        _id: 'google-user-123',
        refreshToken: '',
        lastLogin: null,
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({
          _id: 'google-user-123',
          email: 'google@example.com',
          name: 'Google User',
        }),
      };

      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ access_token: 'google-access-token' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({
            sub: 'google-sub-123',
            email: 'google@example.com',
            name: 'Google User',
            picture: 'https://example.com/avatar.png',
          }),
        });

      User.findOne.mockResolvedValue(null);
      User.create.mockResolvedValue(mockUser);
      generateAccessToken.mockReturnValue('app_access_token');
      generateRefreshToken.mockReturnValue('app_refresh_token');

      const { req, res, next } = createMocks();
      req.query = { code: 'google_auth_code', state: 'state-123' };
      req.cookies = {
        google_oauth_state: 'state-123',
        google_oauth_redirect: '/dashboard',
      };

      googleCallback(req, res, next);
      await flushPromises();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({
        email: 'google@example.com',
        provider: 'google',
        googleId: 'google-sub-123',
      }));
      expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'app_refresh_token', expect.any(Object));
      expect(res.clearCookie).toHaveBeenCalledWith('google_oauth_state');
      expect(res.clearCookie).toHaveBeenCalledWith('google_oauth_redirect');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/auth/google/callback?accessToken=app_access_token&redirect=%2Fdashboard'
      );
    });

    it('should redirect with an error when OAuth state is invalid', async () => {
      const { req, res, next } = createMocks();
      req.query = { code: 'google_auth_code', state: 'wrong-state' };
      req.cookies = {
        google_oauth_state: 'expected-state',
        google_oauth_redirect: '/dashboard',
      };

      googleCallback(req, res, next);
      await flushPromises();

      expect(res.clearCookie).toHaveBeenCalledWith('google_oauth_state');
      expect(res.clearCookie).toHaveBeenCalledWith('google_oauth_redirect');
      expect(res.redirect).toHaveBeenCalledWith(
        'http://localhost:5173/auth/google/callback?error=Invalid%20Google%20OAuth%20state'
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
