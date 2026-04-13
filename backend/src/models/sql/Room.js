const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Room = sequelize.define('Room', {
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
  hotelTitle: {
    type: DataTypes.STRING(255),
  },
  // hotelId will be added by association
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  pricePerNight: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  maxGuests: {
    type: DataTypes.INTEGER,
    defaultValue: 2,
  },
  totalRooms: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  bedType: DataTypes.STRING(50),
  size: DataTypes.FLOAT,
  
  amenities: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  images: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  timestamps: true,
  tableName: 'rooms'
});

module.exports = Room;
