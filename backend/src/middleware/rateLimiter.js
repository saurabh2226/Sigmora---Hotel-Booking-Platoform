const rateLimit = require('express-rate-limit');

const skipRateLimitInTests = () => process.env.NODE_ENV === 'test';
const MINUTE = 60 * 1000;

const shouldSkip = (req) => (
  skipRateLimitInTests()
  || req.path === '/health'
  || req.method === 'OPTIONS'
);

const createJsonHandler = (fallbackMessage, windowMs) => (req, res, next, options) => {
  const resetTime = req.rateLimit?.resetTime instanceof Date
    ? req.rateLimit.resetTime.getTime()
    : Date.now() + windowMs;

  return res.status(options.statusCode).json({
    success: false,
    message: typeof options.message === 'string'
      ? options.message
      : options.message?.message || fallbackMessage,
    retryAfterSeconds: Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)),
  });
};

const createLimiter = ({
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false,
}) => rateLimit({
  windowMs,
  max,
  skip: shouldSkip,
  skipSuccessfulRequests,
  requestWasSuccessful: (req, res) => res.statusCode < 400,
  message: {
    success: false,
    message,
  },
  handler: createJsonHandler(message, windowMs),
  standardHeaders: true,
  legacyHeaders: false,
});

// General API rate limiter
const generalLimiter = createLimiter({
  windowMs: 10 * MINUTE,
  max: 900,
  message: 'Too many requests, please slow down for a moment.',
});

// Auth rate limiter: only count failed attempts, so normal successful logins don't get blocked.
const authLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  max: 20,
  message: 'Too many failed authentication attempts, please try again shortly.',
  skipSuccessfulRequests: true,
});

// Payment rate limiter
const paymentLimiter = createLimiter({
  windowMs: 10 * MINUTE,
  max: 50,
  message: 'Too many payment requests, please wait a bit before retrying.',
});

const bookingWriteLimiter = createLimiter({
  windowMs: 10 * MINUTE,
  max: 60,
  message: 'Too many booking updates in a short time. Please try again in a moment.',
});

const supportWriteLimiter = createLimiter({
  windowMs: 5 * MINUTE,
  max: 120,
  message: 'Too many support messages were sent too quickly. Please pause for a moment.',
});

const secureActionLimiter = createLimiter({
  windowMs: 15 * MINUTE,
  max: 45,
  message: 'Too many secure account actions were attempted. Please wait a moment and retry.',
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  bookingWriteLimiter,
  supportWriteLimiter,
  secureActionLimiter,
};
