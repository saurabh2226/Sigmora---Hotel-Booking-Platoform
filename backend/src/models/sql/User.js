const { DataTypes } = require('sequelize');
const { sequelize } = require('../../config/sequelize');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  mongoId: {
    type: DataTypes.STRING(24),
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  avatar: {
    type: DataTypes.STRING(500),
    defaultValue: '',
  },
  role: {
    type: DataTypes.ENUM('user', 'owner', 'admin', 'superadmin'),
    defaultValue: 'user',
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'suspended'),
    defaultValue: 'active',
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  provider: {
    type: DataTypes.ENUM('local', 'google'),
    defaultValue: 'local',
  },
  googleId: {
    type: DataTypes.STRING(255),
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR'
  },
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  theme: {
    type: DataTypes.STRING(10),
    defaultValue: 'light'
  },
  lastLogin: {
    type: DataTypes.DATE,
  },
}, {
  timestamps: true,
  tableName: 'users'
});

module.exports = User;
