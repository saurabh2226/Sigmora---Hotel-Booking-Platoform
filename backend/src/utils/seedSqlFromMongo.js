require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { sequelize, User, Hotel, Room, Booking, Review, Coupon, Payment, Notification } = require('../models/sql');
const { connectSequelize } = require('../config/sequelize');
const { syncAllMongoDataToSql } = require('../services/sqlMirrorService');

const seedSqlFromMongo = async () => {
  try {
    await connectDB();
    await connectSequelize({ syncSchema: true, alter: true });

    const counts = await syncAllMongoDataToSql();

    console.log('\nSQL mirror sync completed without deleting existing data.');
    console.log(`- users: ${counts.users}`);
    console.log(`- hotels: ${counts.hotels}`);
    console.log(`- rooms: ${counts.rooms}`);
    console.log(`- coupons: ${counts.coupons}`);
    console.log(`- bookings: ${counts.bookings}`);
    console.log(`- reviews: ${counts.reviews}`);
    console.log(`- payments: ${counts.payments}`);
    console.log(`- notifications: ${counts.notifications}`);
    console.log('\nActive SQL tables:');
    [User, Hotel, Room, Booking, Review, Coupon, Payment, Notification].forEach((model) => {
      console.log(`- ${model.getTableName()}`);
    });

    await sequelize.close();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('SQL seed sync error:', error.message);
    process.exit(1);
  }
};

seedSqlFromMongo();
