const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Hotel = sequelize.define('Hotel', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING(24),
    unique: true,
  },
  createdByMongoId: {
    type: DataTypes.STRING(24),
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(255),
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  pricePerNight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  street: DataTypes.STRING(255),
  city: DataTypes.STRING(100),
  state: DataTypes.STRING(100),
  zipCode: DataTypes.STRING(20),
  country: {
    type: DataTypes.STRING(100),
    defaultValue: 'India'
  },
  latitude: DataTypes.FLOAT,
  longitude: DataTypes.FLOAT,
  maxGuests: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  totalRooms: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rating: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  isFeatured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'maintenance'),
    defaultValue: 'active',
  },
  
  amenities: {
    type: DataTypes.JSON, // Arrays are JSON in MySQL
    defaultValue: []
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  policies: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
  contact: {
    type: DataTypes.JSON,
    defaultValue: {},
  },
}, {
  timestamps: true,
  tableName: 'hotels'
});

module.exports = Hotel;
