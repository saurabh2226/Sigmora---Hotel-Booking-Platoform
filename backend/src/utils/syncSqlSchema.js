require('dotenv').config();

const mongoose = require('mongoose');
const { sequelize, User, Hotel, Room, Booking, Review, Coupon, Payment, Notification } = require('../models/sql');
const { connectSequelize } = require('../config/sequelize');

const syncSqlSchema = async () => {
  try {
    await connectSequelize({ syncSchema: true, alter: true });

    console.log('\nSQL tables ready:');
    [User, Hotel, Room, Booking, Review, Coupon, Payment, Notification].forEach((model) => {
      console.log(`- ${model.getTableName()}`);
    });

    await sequelize.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('SQL schema sync error:', error.message);
    process.exit(1);
  }
};

syncSqlSchema();
