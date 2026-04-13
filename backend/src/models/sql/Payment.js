const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING(24),
    unique: true,
  },
  bookingMongoId: {
    type: DataTypes.STRING(24),
  },
  userMongoId: {
    type: DataTypes.STRING(24),
  },
  // bookingId, userId added via association
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
  },
  method: {
    type: DataTypes.ENUM('razorpay'),
    allowNull: false,
  },
  transactionId: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed', 'partial_refunded', 'refunded'),
    defaultValue: 'pending',
  },
  gatewayResponse: {
    type: DataTypes.JSON,
  },
  refundId: DataTypes.STRING(255),
  refundedAt: DataTypes.DATE,
}, {
  timestamps: true,
  tableName: 'payments',
});

module.exports = Payment;
