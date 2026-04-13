const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('\n❌ MONGODB_URI is not set in .env file');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
    if (error.message.includes('ECONNREFUSED')) {
      console.error('\n💡 Fix: MongoDB is not running locally. Either:');
      console.error('   1. Install & start MongoDB locally, OR');
      console.error('   2. Use MongoDB Atlas (free) — update MONGODB_URI in backend/.env:');
      console.error('      MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/hotel-booking\n');
    }
    process.exit(1);
  }
};

module.exports = connectDB;
