const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING(24),
    unique: true,
  },
  userMongoId: {
    type: DataTypes.STRING(24),
  },
  hotelMongoId: {
    type: DataTypes.STRING(24),
  },
  roomMongoId: {
    type: DataTypes.STRING(24),
  },
  ownerMongoId: {
    type: DataTypes.STRING(24),
  },
  userName: DataTypes.STRING(100),
  userEmail: DataTypes.STRING(150),
  hotelTitle: DataTypes.STRING(255),
  hotelCity: DataTypes.STRING(120),
  roomTitle: DataTypes.STRING(255),
  roomType: DataTypes.STRING(50),
  // userId, hotelId, roomId handled by association
  checkIn: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  checkOut: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  adults: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  children: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  guestName: DataTypes.STRING(100),
  guestEmail: DataTypes.STRING(150),
  guestPhone: DataTypes.STRING(20),
  
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'checked-in', 'checked-out', 'cancelled', 'no-show'),
    defaultValue: 'pending',
  },
  
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  taxes: DataTypes.DECIMAL(10, 2),
  serviceFee: DataTypes.DECIMAL(10, 2),
  discount: DataTypes.DECIMAL(10, 2),
  totalAmount: DataTypes.DECIMAL(10, 2),
  numberOfNights: DataTypes.INTEGER,
  couponCode: DataTypes.STRING(50),
  holdExpiresAt: DataTypes.DATE,
  
  razorpayPaymentId: DataTypes.STRING(255),
  razorpayOrderId: DataTypes.STRING(255),
  paymentStatus: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'partial_refunded', 'refunded'),
    defaultValue: 'pending',
  },
  paymentMethod: {
    type: DataTypes.STRING(50)
  },
  
  specialRequests: DataTypes.TEXT,
  cancellationReason: DataTypes.STRING(255),
  refundAmount: DataTypes.DECIMAL(10, 2),
}, {
  timestamps: true,
  tableName: 'bookings'
});

module.exports = Booking;
