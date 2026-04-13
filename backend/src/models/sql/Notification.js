const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const Notification = sequelize.define('Notification', {
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
  // userId added via association
  type: {
    type: DataTypes.ENUM('booking', 'payment', 'review', 'system', 'promotion'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  link: DataTypes.STRING(500),
  metadata: {
    type: DataTypes.JSON,
  },
}, {
  timestamps: true,
  tableName: 'notifications',
});

module.exports = Notification;
