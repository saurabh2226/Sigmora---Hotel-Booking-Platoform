const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { authLimiter, secureActionLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  registerValidation, loginValidation, forgotPasswordValidation,
  resetPasswordValidation, changePasswordValidation, updateProfileValidation,
  verifyOtpValidation, resendOtpValidation, resetPasswordSessionValidation,
} = require('../utils/validators');
const {
  register, login, logout, refreshAccessToken, verifyEmail,
  verifyEmailOtp, resendOtp, forgotPassword, verifyResetPasswordOtp, resetPassword, resetPasswordWithSession, getMe, updateProfile, changePassword,
  googleAuth, googleCallback,
} = require('../controllers/authController');

router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/login', authLimiter, loginValidation, validate, login);
router.get('/google', googleAuth);
router.get('/google/callback', googleCallback);
router.post('/logout', auth, secureActionLimiter, logout);
router.post('/refresh-token', secureActionLimiter, refreshAccessToken);
router.get('/verify-email/:token', verifyEmail);
router.post('/verify-email-otp', authLimiter, verifyOtpValidation, validate, verifyEmailOtp);
router.post('/resend-otp', authLimiter, resendOtpValidation, validate, resendOtp);
router.post('/forgot-password', authLimiter, forgotPasswordValidation, validate, forgotPassword);
router.post('/verify-reset-password-otp', authLimiter, verifyOtpValidation, validate, verifyResetPasswordOtp);
router.post('/reset-password/:token', secureActionLimiter, resetPasswordValidation, validate, resetPassword);
router.post('/reset-password-session', secureActionLimiter, resetPasswordSessionValidation, validate, resetPasswordWithSession);
router.get('/me', auth, getMe);
router.put('/update-profile', auth, secureActionLimiter, updateProfileValidation, validate, updateProfile);
router.put('/change-password', auth, secureActionLimiter, changePasswordValidation, validate, changePassword);

module.exports = router;
