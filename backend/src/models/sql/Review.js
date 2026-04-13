const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Review = sequelize.define('Review', {
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
  bookingMongoId: {
    type: DataTypes.STRING(24),
  },
  // userId, hotelId, bookingId handled by association
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 }
  },
  title: DataTypes.STRING(150),
  comment: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  
  // Categories (using JSON to easily store cleanliness, comfort, etc.)
  categories: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  
  helpfulVotes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: [],
  },
  adminResponse: DataTypes.TEXT,
  adminResponseAt: DataTypes.DATE,
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  timestamps: true,
  tableName: 'reviews'
});

module.exports = Review;
