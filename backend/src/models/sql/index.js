const { sequelize } = require('../../config/sequelize');

// Import models
const User = require('./User');
const Hotel = require('./Hotel');
const Room = require('./Room');
const Booking = require('./Booking');
const Review = require('./Review');
const Coupon = require('./Coupon');
const Payment = require('./Payment');
const Notification = require('./Notification');

User.hasMany(Hotel, { foreignKey: 'createdById', as: 'managedHotels' });
Hotel.belongsTo(User, { foreignKey: 'createdById', as: 'owner' });

// Define Relationships

// Hotel 1:N Rooms
Hotel.hasMany(Room, { foreignKey: 'hotelId', as: 'rooms', onDelete: 'CASCADE' });
Room.belongsTo(Hotel, { foreignKey: 'hotelId', as: 'hotel' });

// User 1:N Bookings
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Hotel 1:N Bookings
Hotel.hasMany(Booking, { foreignKey: 'hotelId', as: 'bookings' });
Booking.belongsTo(Hotel, { foreignKey: 'hotelId', as: 'hotel' });

// Room 1:N Bookings
Room.hasMany(Booking, { foreignKey: 'roomId', as: 'bookings' });
Booking.belongsTo(Room, { foreignKey: 'roomId', as: 'room' });

// User 1:N Reviews
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Hotel 1:N Reviews
Hotel.hasMany(Review, { foreignKey: 'hotelId', as: 'reviews' });
Review.belongsTo(Hotel, { foreignKey: 'hotelId', as: 'hotel' });

// Booking 1:1 Review (Review belongs to a specific booking)
Booking.hasOne(Review, { foreignKey: 'bookingId', as: 'review' });
Review.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

Hotel.hasMany(Coupon, { foreignKey: 'hotelId', as: 'coupons' });
Coupon.belongsTo(Hotel, { foreignKey: 'hotelId', as: 'hotel' });

User.hasMany(Coupon, { foreignKey: 'createdById', as: 'createdCoupons' });
Coupon.belongsTo(User, { foreignKey: 'createdById', as: 'createdBy' });

Booking.hasMany(Payment, { foreignKey: 'bookingId', as: 'payments' });
Payment.belongsTo(Booking, { foreignKey: 'bookingId', as: 'booking' });

User.hasMany(Payment, { foreignKey: 'userId', as: 'payments' });
Payment.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Export everything
module.exports = {
  sequelize,
  User,
  Hotel,
  Room,
  Booking,
  Review,
  Coupon,
  Payment,
  Notification,
};
