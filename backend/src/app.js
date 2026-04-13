const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');

const errorHandler = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const ApiError = require('./utils/ApiError');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const adminRoutes = require('./routes/adminRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const couponRoutes = require('./routes/couponRoutes');
const supportRoutes = require('./routes/supportRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');

const app = express();
const configuredClientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

// ====== SECURITY MIDDLEWARE ======
app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (origin === configuredClientUrl || localhostOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ====== BODY PARSERS ======
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith('/api/v1/payments/webhook')) {
      req.rawBody = buf.toString('utf8');
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ====== DATA SANITIZATION ======
app.use(mongoSanitize());

// xss-clean may have issues with newer Node versions, wrap in try-catch
try {
  const xss = require('xss-clean');
  app.use(xss());
} catch (e) {
  console.warn('xss-clean not loaded:', e.message);
}

app.use(hpp());

// ====== COMPRESSION & LOGGING ======
app.use(compression());

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ====== RATE LIMITING ======
if (process.env.NODE_ENV !== 'test') {
  app.use('/api/', generalLimiter);
}

// ====== HEALTH CHECK ======
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Sigmora API is running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ====== API ROUTES ======
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/hotels', hotelRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/subscriptions', subscriptionRoutes);

// ====== 404 HANDLER ======
app.all('*', (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
});

// ====== ERROR HANDLER ======
app.use(errorHandler);

module.exports = app;
