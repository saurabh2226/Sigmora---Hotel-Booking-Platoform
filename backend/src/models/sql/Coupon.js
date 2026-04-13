const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Coupon = sequelize.define('Coupon', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING(24),
    unique: true,
  },
  hotelMongoId: {
    type: DataTypes.STRING(24),
  },
  createdByMongoId: {
    type: DataTypes.STRING(24),
  },
  title: {
    type: DataTypes.STRING(100),
    defaultValue: '',
  },
  description: {
    type: DataTypes.STRING(300),
    defaultValue: '',
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  discountType: {
    type: DataTypes.ENUM('percentage', 'flat'),
    allowNull: false,
  },
  discountValue: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  minBookingAmount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  maxDiscount: {
    type: DataTypes.DECIMAL(10, 2),
  },
  bannerText: {
    type: DataTypes.STRING(120),
    defaultValue: '',
  },
  bannerColor: {
    type: DataTypes.STRING(20),
    defaultValue: '#0f766e',
  },
  scope: {
    type: DataTypes.ENUM('global', 'hotel'),
    defaultValue: 'global',
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  validFrom: DataTypes.DATE,
  validUntil: DataTypes.DATE,
  usageLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  usedCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  timestamps: true,
  tableName: 'coupons'
});

module.exports = Coupon;
