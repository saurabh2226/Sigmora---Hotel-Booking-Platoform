const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/generateToken');
const {
  sendVerificationEmail,
  sendVerificationOtpEmail,
  sendPasswordResetEmail,
  sendPasswordResetOtpEmail,
  sendPasswordChangedEmail,
} = require('../services/emailService');
const { syncUserToSql } = require('../services/sqlMirrorService');
const { normalizeRole } = require('../middleware/roles');

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_SESSION_TTL_MS = 15 * 60 * 1000;

const normalizeEmail = (value = '') => value.trim().toLowerCase();

const generateOtp = () => String(crypto.randomInt(100000, 1000000));
const hashToken = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

const ensureSupportedRole = async (user) => {
  const normalizedRole = normalizeRole(user.role);
  if (user.role !== normalizedRole) {
    user.role = normalizedRole;
    await user.save({ validateBeforeSave: false });
    await syncUserToSql(user);
  }

  return user;
};

const buildGoogleCallbackUrl = (req) => {
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL;
  }

  return `${req.protocol}://${req.get('host')}/api/v1/auth/google/callback`;
};

const getOAuthFrontendUrl = () => {
  return process.env.CLIENT_URL || 'http://localhost:5173';
};

const buildGoogleFailureRedirect = (req, message = 'Google authentication failed') => {
  const error = encodeURIComponent(message);
  return `${getOAuthFrontendUrl()}/auth/google/callback?error=${error}`;
};

const setRefreshCookie = (res, refreshToken) => {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

const issueAuthResponse = async (user, res, statusCode, message) => {
  await ensureSupportedRole(user);
  const accessToken = generateAccessToken(user._id);
  const refreshToken = generateRefreshToken(user._id);

  user.refreshToken = refreshToken;
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });
  await syncUserToSql(user);

  setRefreshCookie(res, refreshToken);

  res.status(statusCode).json(
    new ApiResponse(statusCode, {
      accessToken,
      user: user.toJSON(),
    }, message)
  );
};

const persistOtpForUser = async (user, purpose) => {
  const otp = generateOtp();
  user.emailOtpHash = hashToken(otp);
  user.emailOtpExpires = new Date(Date.now() + EMAIL_OTP_TTL_MS);
  user.emailOtpPurpose = purpose;
  await user.save({ validateBeforeSave: false });
  await syncUserToSql(user);
  return otp;
};

const clearOtpForUser = (user) => {
  user.emailOtpHash = undefined;
  user.emailOtpExpires = undefined;
  user.emailOtpPurpose = undefined;
};

const assertValidOtp = (user, otp, purpose) => {
  if (!user?.emailOtpHash || !user?.emailOtpExpires || user.emailOtpPurpose !== purpose) {
    throw new ApiError(400, 'OTP not found or already used');
  }

  if (user.emailOtpExpires.getTime() < Date.now()) {
    throw new ApiError(400, 'OTP expired. Please request a fresh one.');
  }

  if (user.emailOtpHash !== hashToken(otp)) {
    throw new ApiError(400, 'Invalid OTP');
  }
};

const issueOtpResponse = (res, statusCode, message, email, purpose) => {
  res.status(statusCode).json(new ApiResponse(statusCode, {
    requiresOtp: true,
    email,
    purpose,
    expiresInSeconds: Math.floor(EMAIL_OTP_TTL_MS / 1000),
  }, message));
};

const exchangeGoogleCode = async (req, code) => {
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: buildGoogleCallbackUrl(req),
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenResponse.json();

  if (!tokenResponse.ok) {
    throw new ApiError(401, tokenData.error_description || 'Unable to exchange Google authorization code');
  }

  const userResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  const googleUser = await userResponse.json();

  if (!userResponse.ok || !googleUser.email || !googleUser.sub) {
    throw new ApiError(401, 'Unable to fetch Google profile');
  }

  return googleUser;
};

const upsertGoogleUser = async (googleUser) => {
  const fallbackPassword = crypto.randomBytes(32).toString('hex');
  let user = await User.findOne({
    $or: [
      { googleId: googleUser.sub },
      { email: googleUser.email },
    ],
  });

  if (!user) {
    user = await User.create({
      name: googleUser.name || googleUser.email.split('@')[0],
      email: googleUser.email,
      password: fallbackPassword,
      avatar: googleUser.picture || '',
      provider: 'google',
      googleId: googleUser.sub,
      isVerified: true,
    });
    return user;
  }

  user.name = googleUser.name || user.name;
  user.avatar = googleUser.picture || user.avatar;
  user.googleId = googleUser.sub;
  user.provider = 'google';
  user.isVerified = true;
  await user.save({ validateBeforeSave: false });

  return user;
};

// @desc    Register user
// @route   POST /api/v1/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;
  const normalizedEmail = normalizeEmail(email);

  // Check if user exists
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, 'Email already registered');
  }

  // Create user
  const user = await User.create({
    name,
    email: normalizedEmail,
    password,
    phone,
  });
  await syncUserToSql(user);

  const otp = await persistOtpForUser(user, 'verify-email');
  sendVerificationOtpEmail(user, otp).catch(console.error);

  issueOtpResponse(res, 201, 'Account created. Please verify the OTP sent to your email.', user.email, 'verify-email');
});

// @desc    Login user
// @route   POST /api/v1/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = normalizeEmail(email);

  // Find user with password
  const user = await User.findOne({ email: normalizedEmail }).select('+password');
  if (!user) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isActive) {
    throw new ApiError(401, 'Account has been deactivated');
  }

  // Check password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new ApiError(401, 'Invalid email or password');
  }

  if (!user.isVerified) {
    const otp = await persistOtpForUser(user, 'verify-email');
    sendVerificationOtpEmail(user, otp).catch(console.error);
    return issueOtpResponse(res, 200, 'Please verify your email to continue. We sent a fresh OTP.', user.email, 'verify-email');
  }

  await ensureSupportedRole(user);
  await issueAuthResponse(user, res, 200, 'Login successful');
});

// @desc    Logout user
// @route   POST /api/v1/auth/logout
const logout = asyncHandler(async (req, res) => {
  // Clear refresh token
  await User.findByIdAndUpdate(req.user._id, { refreshToken: '' });

  res.clearCookie('refreshToken');

  res.status(200).json(
    new ApiResponse(200, null, 'Logged out successfully')
  );
});

// @desc    Refresh access token
// @route   POST /api/v1/auth/refresh-token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;

  if (!token) {
    throw new ApiError(401, 'Refresh token not found');
  }

  try {
    const decoded = verifyRefreshToken(token);
    const user = await User.findById(decoded.id).select('+refreshToken');

    if (!user || user.refreshToken !== token) {
      throw new ApiError(401, 'Invalid refresh token');
    }

    await ensureSupportedRole(user);
    const accessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save({ validateBeforeSave: false });

    setRefreshCookie(res, newRefreshToken);

    res.status(200).json(
      new ApiResponse(200, { accessToken }, 'Token refreshed')
    );
  } catch (error) {
    throw new ApiError(401, 'Invalid or expired refresh token');
  }
});

// @desc    Verify email
// @route   GET /api/v1/auth/verify-email/:token
const verifyEmail = asyncHandler(async (req, res) => {
  const { token } = req.params;

  const user = await User.findOne({ verificationToken: token });
  if (!user) {
    throw new ApiError(400, 'Invalid or expired verification token');
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  await user.save({ validateBeforeSave: false });
  await syncUserToSql(user);

  res.status(200).json(
    new ApiResponse(200, null, 'Email verified successfully')
  );
});

// @desc    Verify email via OTP and sign user in
// @route   POST /api/v1/auth/verify-email-otp
const verifyEmailOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: normalizeEmail(email) }).select('+refreshToken');

  if (!user) {
    throw new ApiError(404, 'Account not found');
  }

  assertValidOtp(user, otp, 'verify-email');
  user.isVerified = true;
  clearOtpForUser(user);
  await user.save({ validateBeforeSave: false });

  await ensureSupportedRole(user);
  await issueAuthResponse(user, res, 200, 'Email verified successfully');
});

// @desc    Resend OTP for verification or password reset
// @route   POST /api/v1/auth/resend-otp
const resendOtp = asyncHandler(async (req, res) => {
  const { email, purpose = 'verify-email' } = req.body;
  const normalizedEmail = normalizeEmail(email);
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return res.status(200).json(new ApiResponse(200, null, 'If the account exists, a fresh OTP has been sent.'));
  }

  if (purpose === 'verify-email' && user.isVerified) {
    return res.status(200).json(new ApiResponse(200, null, 'This account is already verified.'));
  }

  const otp = await persistOtpForUser(user, purpose);

  if (purpose === 'reset-password') {
    sendPasswordResetOtpEmail(user, otp).catch(console.error);
  } else {
    sendVerificationOtpEmail(user, otp).catch(console.error);
  }

  res.status(200).json(new ApiResponse(200, {
    requiresOtp: true,
    email: user.email,
    purpose,
    expiresInSeconds: Math.floor(EMAIL_OTP_TTL_MS / 1000),
  }, 'A fresh OTP has been sent.'));
});

// @desc    Forgot password
// @route   POST /api/v1/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email: normalizeEmail(email) });
  if (!user) {
    // Don't reveal if email exists
    return res.status(200).json(
      new ApiResponse(200, null, 'If an account with that email exists, an OTP has been sent.')
    );
  }

  const otp = await persistOtpForUser(user, 'reset-password');
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save({ validateBeforeSave: false });
  await syncUserToSql(user);
  sendPasswordResetOtpEmail(user, otp).catch(console.error);

  res.status(200).json(
    new ApiResponse(200, {
      requiresOtp: true,
      email: user.email,
      purpose: 'reset-password',
      expiresInSeconds: Math.floor(EMAIL_OTP_TTL_MS / 1000),
    }, 'If an account with that email exists, an OTP has been sent.')
  );
});

// @desc    Verify password reset OTP
// @route   POST /api/v1/auth/verify-reset-password-otp
const verifyResetPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await User.findOne({ email: normalizeEmail(email) });

  if (!user) {
    throw new ApiError(404, 'Account not found');
  }

  assertValidOtp(user, otp, 'reset-password');
  clearOtpForUser(user);

  const resetSessionToken = crypto.randomBytes(32).toString('hex');
  user.passwordResetSessionToken = hashToken(resetSessionToken);
  user.passwordResetSessionExpires = new Date(Date.now() + PASSWORD_RESET_SESSION_TTL_MS);
  await user.save({ validateBeforeSave: false });
  await syncUserToSql(user);

  res.status(200).json(new ApiResponse(200, {
    resetSessionToken,
    email: user.email,
  }, 'OTP verified successfully'));
});

// @desc    Reset password
// @route   POST /api/v1/auth/reset-password/:token
const resetPassword = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Invalid or expired reset token');
  }

  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  await syncUserToSql(user);

  sendPasswordChangedEmail(user).catch(console.error);

  res.status(200).json(
    new ApiResponse(200, null, 'Password reset successful')
  );
});

// @desc    Reset password with verified OTP session
// @route   POST /api/v1/auth/reset-password-session
const resetPasswordWithSession = asyncHandler(async (req, res) => {
  const { sessionToken, password } = req.body;

  const user = await User.findOne({
    passwordResetSessionToken: hashToken(sessionToken),
    passwordResetSessionExpires: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(400, 'Reset session expired. Please verify a fresh OTP.');
  }

  user.password = password;
  user.passwordResetSessionToken = undefined;
  user.passwordResetSessionExpires = undefined;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
  await syncUserToSql(user);

  sendPasswordChangedEmail(user).catch(console.error);

  res.status(200).json(
    new ApiResponse(200, null, 'Password reset successful')
  );
});

// @desc    Get current user
// @route   GET /api/v1/auth/me
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  await ensureSupportedRole(user);
  res.status(200).json(
    new ApiResponse(200, { user }, 'User fetched')
  );
});

// @desc    Update profile
// @route   PUT /api/v1/auth/update-profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, avatar } = req.body;
  const updates = {};
  if (name) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (avatar !== undefined) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });
  await syncUserToSql(user);

  res.status(200).json(
    new ApiResponse(200, { user }, 'Profile updated')
  );
});

// @desc    Change password
// @route   PUT /api/v1/auth/change-password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new ApiError(400, 'Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  await syncUserToSql(user);

  sendPasswordChangedEmail(user).catch(console.error);

  res.status(200).json(
    new ApiResponse(200, null, 'Password changed successfully')
  );
});

// @desc    Start Google OAuth flow
// @route   GET /api/v1/auth/google
const googleAuth = asyncHandler(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new ApiError(500, 'Google OAuth is not configured');
  }

  const state = crypto.randomBytes(24).toString('hex');
  const redirectPath = typeof req.query.redirect === 'string' && req.query.redirect.startsWith('/')
    ? req.query.redirect
    : '/';

  res.cookie('google_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  res.cookie('google_oauth_redirect', redirectPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 10 * 60 * 1000,
  });

  const authUrl = new URL(GOOGLE_AUTH_BASE_URL);
  authUrl.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: buildGoogleCallbackUrl(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  }).toString();

  res.redirect(authUrl.toString());
});

// @desc    Google OAuth callback
// @route   GET /api/v1/auth/google/callback
const googleCallback = asyncHandler(async (req, res) => {
  const {
    code,
    state,
    error,
  } = req.query;

  const clearOAuthCookies = () => {
    res.clearCookie('google_oauth_state');
    res.clearCookie('google_oauth_redirect');
  };

  if (error) {
    clearOAuthCookies();
    return res.redirect(buildGoogleFailureRedirect(req, String(error)));
  }

  if (!code || !state || state !== req.cookies.google_oauth_state) {
    clearOAuthCookies();
    return res.redirect(buildGoogleFailureRedirect(req, 'Invalid Google OAuth state'));
  }

  const frontendRedirect = typeof req.cookies.google_oauth_redirect === 'string'
    && req.cookies.google_oauth_redirect.startsWith('/')
    ? req.cookies.google_oauth_redirect
    : '/';

  try {
    const googleUser = await exchangeGoogleCode(req, String(code));
    const user = await ensureSupportedRole(await upsertGoogleUser(googleUser));
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });
    await syncUserToSql(user);

    setRefreshCookie(res, refreshToken);
    clearOAuthCookies();

    const redirectUrl = new URL('/auth/google/callback', getOAuthFrontendUrl());
    redirectUrl.searchParams.set('accessToken', accessToken);
    redirectUrl.searchParams.set('redirect', frontendRedirect);

    res.redirect(redirectUrl.toString());
  } catch (oauthError) {
    clearOAuthCookies();
    return res.redirect(buildGoogleFailureRedirect(req, oauthError.message));
  }
});

module.exports = {
  register,
  login,
  logout,
  refreshAccessToken,
  verifyEmail,
  verifyEmailOtp,
  resendOtp,
  forgotPassword,
  verifyResetPasswordOtp,
  resetPassword,
  resetPasswordWithSession,
  getMe,
  updateProfile,
  changePassword,
  googleAuth,
  googleCallback,
};
