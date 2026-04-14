const { body, param, query } = require('express-validator');

// ===== AUTH VALIDATORS =====
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters')
    .matches(/^[a-zA-Z][a-zA-Z\s'.-]*$/).withMessage('Name can only contain letters, spaces, apostrophes, dots, and hyphens'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/).withMessage('Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)'),
  body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN').withMessage('Invalid Indian phone number'),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 1, max: 128 }).withMessage('Password too long'),
];

const adminCreateUserValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters')
    .matches(/^[a-zA-Z][a-zA-Z\s'.-]*$/).withMessage('Name can only contain letters, spaces, apostrophes, dots, and hyphens'),
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin']).withMessage('Role must be user or admin'),
  body('password')
    .optional({ checkFalsy: true })
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/).withMessage('Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)'),
  body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN').withMessage('Invalid Indian phone number'),
];

const forgotPasswordValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
];

const resetPasswordValidation = [
  param('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 10 }).withMessage('Invalid token'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
];

const verifyOtpValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('otp')
    .trim()
    .notEmpty().withMessage('OTP is required')
    .matches(/^\d{6}$/).withMessage('OTP must be 6 digits'),
];

const resendOtpValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Invalid email format')
    .normalizeEmail(),
  body('purpose')
    .optional()
    .isIn(['verify-email', 'reset-password']).withMessage('Invalid OTP purpose'),
];

const resetPasswordSessionValidation = [
  body('sessionToken')
    .trim()
    .notEmpty().withMessage('Reset session token is required')
    .isLength({ min: 20 }).withMessage('Invalid reset session token'),
  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/).withMessage('Password must contain uppercase, lowercase, number, and special character'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .notEmpty().withMessage('New password is required')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8-128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/).withMessage('Password must contain uppercase, lowercase, number, and special character')
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) throw new Error('New password must be different from current password');
      return true;
    }),
];

const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters')
    .matches(/^[a-zA-Z][a-zA-Z\s'.-]*$/).withMessage('Name can only contain letters, spaces, apostrophes, dots, and hyphens'),
  body('phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN').withMessage('Invalid Indian phone number'),
  body('preferences.currency')
    .optional()
    .isIn(['INR', 'USD', 'EUR']).withMessage('Invalid currency'),
  body('preferences.theme')
    .optional()
    .isIn(['light', 'dark']).withMessage('Invalid theme'),
];

// ===== HOTEL VALIDATORS =====
const createHotelValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters')
    .escape(),
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Description must be 10-2000 characters'),
  body('type')
    .notEmpty().withMessage('Type is required')
    .isIn(['hotel', 'resort', 'villa', 'apartment', 'hostel', 'guesthouse']).withMessage('Invalid hotel type'),
  body('address.street').optional().trim().isLength({ max: 200 }),
  body('address.city')
    .notEmpty().withMessage('City is required')
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('City must be 2-100 characters'),
  body('address.state')
    .notEmpty().withMessage('State is required')
    .trim(),
  body('address.zipCode')
    .optional()
    .matches(/^[1-9][0-9]{5}$/).withMessage('Invalid Indian PIN code'),
  body('address.country').optional().default('India'),
  body('pricePerNight')
    .notEmpty().withMessage('Price per night is required')
    .isFloat({ min: 100, max: 500000 }).withMessage('Price must be between ₹100 and ₹5,00,000'),
  body('maxGuests')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Max guests must be 1-50'),
  body('totalRooms')
    .notEmpty().withMessage('Total rooms is required')
    .isInt({ min: 1, max: 1000 }).withMessage('Total rooms must be 1-1000'),
  body('amenities')
    .optional()
    .isArray().withMessage('Amenities must be an array'),
  body('amenities.*')
    .optional()
    .isString().withMessage('Each amenity must be a string'),
];

const createRoomValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Room title is required')
    .isLength({ min: 2, max: 100 }).withMessage('Title must be 2-100 characters'),
  body('type')
    .notEmpty().withMessage('Room type is required')
    .isIn(['single', 'double', 'suite', 'deluxe', 'penthouse', 'dormitory']).withMessage('Invalid room type'),
  body('pricePerNight')
    .notEmpty().withMessage('Price per night is required')
    .isFloat({ min: 100, max: 500000 }).withMessage('Price must be between ₹100 and ₹5,00,000'),
  body('maxGuests')
    .notEmpty().withMessage('Max guests is required')
    .isInt({ min: 1, max: 20 }).withMessage('Max guests must be 1-20'),
  body('totalRooms')
    .optional()
    .isInt({ min: 1, max: 500 }).withMessage('Total rooms must be 1-500'),
  body('bedType')
    .optional()
    .isIn(['single', 'double', 'queen', 'king', 'twin']).withMessage('Invalid bed type'),
  body('size')
    .optional()
    .isFloat({ min: 10, max: 10000 }).withMessage('Room size must be 10-10000 sq ft'),
];

// ===== BOOKING VALIDATORS =====
const createBookingValidation = [
  body('hotel')
    .notEmpty().withMessage('Hotel ID is required')
    .isMongoId().withMessage('Invalid hotel ID'),
  body('room')
    .notEmpty().withMessage('Room ID is required')
    .isMongoId().withMessage('Invalid room ID'),
  body('checkIn')
    .notEmpty().withMessage('Check-in date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value) => {
      const checkIn = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (checkIn < today) throw new Error('Check-in date cannot be in the past');
      return true;
    }),
  body('checkOut')
    .notEmpty().withMessage('Check-out date is required')
    .isISO8601().withMessage('Invalid date format')
    .custom((value, { req }) => {
      const checkIn = new Date(req.body.checkIn);
      const checkOut = new Date(value);
      if (checkOut <= checkIn) throw new Error('Check-out must be after check-in');
      const nights = (checkOut - checkIn) / (1000 * 60 * 60 * 24);
      if (nights > 30) throw new Error('Maximum booking duration is 30 nights');
      return true;
    }),
  body('guests.adults')
    .notEmpty().withMessage('Number of adults is required')
    .isInt({ min: 1, max: 10 }).withMessage('Adults must be 1-10'),
  body('guests.children')
    .optional()
    .isInt({ min: 0, max: 6 }).withMessage('Children must be 0-6'),
  body('guestDetails.name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Guest name must be 2-100 characters'),
  body('guestDetails.email')
    .optional()
    .isEmail().withMessage('Invalid guest email'),
  body('guestDetails.phone')
    .optional({ checkFalsy: true })
    .isMobilePhone('en-IN').withMessage('Invalid phone number'),
  body('guestDetails.checkInTime')
    .optional({ checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid check-in time'),
  body('guestDetails.checkOutTime')
    .optional({ checkFalsy: true })
    .matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('Invalid check-out time'),
  body('couponCode')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 20 }).withMessage('Invalid coupon code'),
];

// ===== REVIEW VALIDATORS =====
const createReviewValidation = [
  body('hotel')
    .notEmpty().withMessage('Hotel ID is required')
    .isMongoId().withMessage('Invalid hotel ID'),
  body('booking')
    .notEmpty().withMessage('Booking ID is required')
    .isMongoId().withMessage('Invalid booking ID'),
  body('rating')
    .notEmpty().withMessage('Rating is required')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('comment')
    .trim()
    .notEmpty().withMessage('Comment is required')
    .isLength({ min: 10, max: 1000 }).withMessage('Comment must be 10-1000 characters'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
  body('categories.cleanliness')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Cleanliness rating must be 1-5'),
  body('categories.comfort')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Comfort rating must be 1-5'),
  body('categories.location')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Location rating must be 1-5'),
  body('categories.facilities')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Facilities rating must be 1-5'),
  body('categories.staff')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Staff rating must be 1-5'),
  body('categories.valueForMoney')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Value rating must be 1-5'),
];

// ===== COUPON VALIDATORS =====
const createCouponValidation = [
  body('title')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ min: 3, max: 100 }).withMessage('Title must be 3-100 characters'),
  body('description')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 300 }).withMessage('Description cannot exceed 300 characters'),
  body('code')
    .trim()
    .notEmpty().withMessage('Coupon code is required')
    .isLength({ min: 3, max: 20 }).withMessage('Code must be 3-20 characters')
    .matches(/^[A-Z0-9]+$/).withMessage('Coupon code must be uppercase alphanumeric'),
  body('discountType')
    .notEmpty().withMessage('Discount type is required')
    .isIn(['percentage', 'flat']).withMessage('Invalid discount type'),
  body('discountValue')
    .notEmpty().withMessage('Discount value is required')
    .isFloat({ min: 1 }).withMessage('Value must be at least 1')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percentage' && value > 100) throw new Error('Percentage cannot exceed 100');
      return true;
    }),
  body('minBookingAmount')
    .optional()
    .isFloat({ min: 0 }).withMessage('Minimum amount must be positive'),
  body('maxDiscount')
    .optional()
    .isFloat({ min: 1 }).withMessage('Max discount must be at least 1'),
  body('validFrom')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('validUntil')
    .optional()
    .isISO8601().withMessage('Invalid date format')
    .custom((value, { req }) => {
      if (req.body.validFrom && new Date(value) <= new Date(req.body.validFrom)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  body('usageLimit')
    .optional()
    .isInt({ min: 1, max: 100000 }).withMessage('Usage limit must be 1-100000'),
  body('priority')
    .optional()
    .isInt({ min: -100, max: 100 }).withMessage('Priority must be between -100 and 100'),
  body('hotel')
    .optional({ checkFalsy: true })
    .isMongoId().withMessage('Invalid hotel ID'),
  body('bannerText')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 }).withMessage('Banner text cannot exceed 120 characters'),
  body('bannerColor')
    .optional({ checkFalsy: true })
    .matches(/^#(?:[0-9a-fA-F]{3}){1,2}$/).withMessage('Banner color must be a valid hex color'),
];

// ===== COMMON VALIDATORS =====
const paginationValidation = [
  query('page').optional().isInt({ min: 1, max: 1000 }).withMessage('Page must be 1-1000'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
];

const mongoIdParam = [
  param('id').isMongoId().withMessage('Invalid ID format'),
];

const searchValidation = [
  query('search').optional().trim().isLength({ max: 100 }).withMessage('Search query too long'),
  query('city').optional().trim().isLength({ max: 100 }),
  query('minPrice').optional().isFloat({ min: 0, max: 500000 }),
  query('maxPrice').optional().isFloat({ min: 0, max: 500000 }),
  query('rating').optional().isFloat({ min: 0, max: 5 }),
  query('type').optional().isIn(['hotel', 'resort', 'villa', 'apartment', 'hostel', 'guesthouse', '']),
  query('sort').optional().isIn(['-rating', 'pricePerNight', '-pricePerNight', '-createdAt', 'createdAt', '']),
];

module.exports = {
  registerValidation,
  loginValidation,
  adminCreateUserValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  verifyOtpValidation,
  resendOtpValidation,
  resetPasswordSessionValidation,
  changePasswordValidation,
  updateProfileValidation,
  createHotelValidation,
  createRoomValidation,
  createBookingValidation,
  createReviewValidation,
  createCouponValidation,
  paginationValidation,
  mongoIdParam,
  searchValidation,
};
