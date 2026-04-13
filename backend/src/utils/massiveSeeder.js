const mongoose = require('mongoose');
const { faker } = require('@faker-js/faker');
const dotenv = require('dotenv');
const { sequelize, User: SqlUser, Hotel: SqlHotel, Room: SqlRoom, Booking: SqlBooking, Review: SqlReview, Coupon: SqlCoupon } = require('../models/sql');

// Mongoose Models
const MongoUser = require('../models/User');
const MongoHotel = require('../models/Hotel');
const MongoRoom = require('../models/Room');
const MongoBooking = require('../models/Booking');
const MongoReview = require('../models/Review');
const MongoCoupon = require('../models/Coupon');

dotenv.config();

// Constants for generation limits
const NUM_USERS = 5000;
const NUM_HOTELS = 1000;
const NUM_ROOMS_PER_HOTEL = 3;
const NUM_BOOKINGS = 10000;
const NUM_REVIEWS = 5000;
const BATCH_SIZE = 1000; // Batch limit to prevent memory crash

const connectDatabases = async () => {
  // Connect MongoDB
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-booking');
  console.log('MongoDB Hooked for Massive Seeding');

  // Connect Sequelize
  await sequelize.authenticate();
  console.log('SQL Hooked for Massive Seeding');
  
  // Wipe SQL Data & Structure
  await sequelize.sync({ force: true });
  console.log('SQL Tables Re-created');

  // Wipe Mongo Data
  await mongoose.connection.dropDatabase();
  console.log('MongoDB Dropped');
};

const massiveSeed = async () => {
  try {
    await connectDatabases();
    
    const startTime = Date.now();
    console.log(`\n🚀 Starting Massive Data Generation...\n`);

    // --- GENERATE USERS ---
    console.log(`Generating ${NUM_USERS} Users...`);
    const usersData = [];
    const mongoUsers = [];
    for (let i = 0; i < NUM_USERS; i++) {
      const sqlId = faker.string.uuid();
      const mongoId = new mongoose.Types.ObjectId();
      const name = faker.person.fullName();
      const email = faker.internet.email() + i;
      const phone = '+91' + faker.string.numeric(10);
      
      // We store the mapping so we can link relations later
      usersData.push({
        id: sqlId, mongoId, name, email, phone,
        password: 'hashedpassword123', role: i === 0 ? 'admin' : 'user',
        status: 'active'
      });
    }

    // Insert Users in batches
    for (let i = 0; i < usersData.length; i += BATCH_SIZE) {
      const batch = usersData.slice(i, i + BATCH_SIZE);
      await SqlUser.bulkCreate(batch);
      await MongoUser.insertMany(batch.map(u => ({ _id: u.mongoId, name: u.name, email: u.email, password: u.password, phone: u.phone, role: u.role, status: u.status })));
    }
    console.log(`✅ Users generated (${NUM_USERS})`);

    // --- GENERATE HOTELS ---
    console.log(`Generating ${NUM_HOTELS} Hotels...`);
    const hotelsData = [];
    for (let i = 0; i < NUM_HOTELS; i++) {
        const sqlId = faker.string.uuid();
        const mongoId = new mongoose.Types.ObjectId();
        const title = faker.company.name() + " Hotel";
        const price = faker.number.int({ min: 500, max: 20000 });
        
        hotelsData.push({
            id: sqlId, mongoId,
            title, slug: faker.helpers.slugify(title).toLowerCase() + '-' + sqlId.substring(0,8),
            description: faker.lorem.paragraphs(2),
            type: faker.helpers.arrayElement(['hotel', 'resort', 'villa', 'apartment']),
            pricePerNight: price,
            street: faker.location.streetAddress(),
            city: faker.location.city(),
            state: faker.location.state(),
            zipCode: faker.number.int({ min: 100000, max: 999999 }).toString(),
            latitude: faker.location.latitude(), longitude: faker.location.longitude(),
            rating: faker.number.float({ min: 3, max: 5, multipleOf: 0.1 }),
            totalReviews: faker.number.int({ min: 10, max: 500 }),
            amenities: ['wifi', 'parking', 'ac', 'tv'],
            images: [faker.image.urlLoremFlickr({ category: 'hotel' })]
        });
    }

    // Insert Hotels in batches
    for (let i = 0; i < hotelsData.length; i += BATCH_SIZE) {
      const batch = hotelsData.slice(i, i + BATCH_SIZE);
      await SqlHotel.bulkCreate(batch);
      await MongoHotel.insertMany(batch.map(h => ({
         _id: h.mongoId, title: h.title, slug: h.slug, description: h.description, type: h.type,
         pricePerNight: h.pricePerNight, 
         address: { street: h.street, city: h.city, state: h.state, zipCode: h.zipCode },
         location: { coordinates: [h.longitude, h.latitude] },
         rating: h.rating, totalReviews: h.totalReviews, amenities: h.amenities, images: h.images
      })));
    }
    console.log(`✅ Hotels generated (${NUM_HOTELS})`);

    // --- GENERATE ROOMS ---
    console.log(`Generating ${NUM_HOTELS * NUM_ROOMS_PER_HOTEL} Rooms...`);
    const roomsData = [];
    for (const h of hotelsData) {
        for (let i = 0; i < NUM_ROOMS_PER_HOTEL; i++) {
            const sqlId = faker.string.uuid();
            const mongoId = new mongoose.Types.ObjectId();
            roomsData.push({
                id: sqlId, mongoId,
                hotelId: h.id, mongoHotelId: h.mongoId, // specific mappings
                title: faker.helpers.arrayElement(['Deluxe', 'Suite', 'Standard']) + ' Room',
                type: faker.helpers.arrayElement(['double', 'single', 'suite']),
                pricePerNight: h.pricePerNight * faker.number.float({ min: 0.8, max: 2, multipleOf: 0.1 }), // relative to hotel
                maxGuests: faker.number.int({ min: 2, max: 6 }),
                totalRooms: faker.number.int({ min: 5, max: 20 }),
                bedType: 'queen', size: 300,
                amenities: ['wifi', 'ac']
            });
        }
    }

    // Insert Rooms
    for (let i = 0; i < roomsData.length; i += BATCH_SIZE) {
      const batch = roomsData.slice(i, i + BATCH_SIZE);
      await SqlRoom.bulkCreate(batch);
      await MongoRoom.insertMany(batch.map(r => ({
          _id: r.mongoId, hotel: r.mongoHotelId, title: r.title, type: r.type,
          pricePerNight: r.pricePerNight, maxGuests: r.maxGuests, totalRooms: r.totalRooms, bedType: r.bedType
      })));
    }
    console.log(`✅ Rooms generated (${NUM_HOTELS * NUM_ROOMS_PER_HOTEL})`);

    // --- GENERATE BOOKINGS ---
    console.log(`Generating ${NUM_BOOKINGS} Bookings...`);
    const bookingsData = [];
    for (let i = 0; i < NUM_BOOKINGS; i++) {
        const u = faker.helpers.arrayElement(usersData);
        const r = faker.helpers.arrayElement(roomsData);
        const checkIn = faker.date.soon({ days: 30 });
        const checkOut = new Date(checkIn);
        checkOut.setDate(checkOut.getDate() + faker.number.int({ min: 1, max: 5 }));

        const sqlId = faker.string.uuid();
        const mongoId = new mongoose.Types.ObjectId();
        bookingsData.push({
            id: sqlId, mongoId,
            userId: u.id, mongoUserId: u.mongoId,
            hotelId: r.hotelId, mongoHotelId: r.mongoHotelId,
            roomId: r.id, mongoRoomId: r.mongoId,
            checkIn: checkIn, checkOut: checkOut,
            adults: 2, children: 0,
            amount: r.pricePerNight,
            totalAmount: r.pricePerNight * 1.12, // +taxes
            status: faker.helpers.arrayElement(['confirmed', 'pending', 'cancelled', 'checked-out'])
        });
    }

    // Insert Bookings
    for (let i = 0; i < bookingsData.length; i += BATCH_SIZE) {
      const batch = bookingsData.slice(i, i + BATCH_SIZE);
      await SqlBooking.bulkCreate(batch);
      await MongoBooking.insertMany(batch.map(b => ({
          _id: b.mongoId, user: b.mongoUserId, hotel: b.mongoHotelId, room: b.mongoRoomId,
          checkIn: b.checkIn, checkOut: b.checkOut, guests: { adults: b.adults, children: b.children },
          amount: b.amount, totalAmount: b.totalAmount, status: b.status
      })));
    }
    console.log(`✅ Bookings generated (${NUM_BOOKINGS})`);

    // --- GENERATE REVIEWS ---
    console.log(`Generating ${NUM_REVIEWS} Reviews...`);
    const reviewsData = [];
    for (let i = 0; i < NUM_REVIEWS; i++) {
        const b = faker.helpers.arrayElement(bookingsData);
        if (b.status !== 'checked-out' && faker.number.int(10) > 2) continue; // Only review checked-out usually

        const sqlId = faker.string.uuid();
        const mongoId = new mongoose.Types.ObjectId();
        reviewsData.push({
            id: sqlId, mongoId,
            userId: b.userId, mongoUserId: b.mongoUserId,
            hotelId: b.hotelId, mongoHotelId: b.mongoHotelId,
            bookingId: b.id, mongoBookingId: b.mongoId,
            rating: faker.number.int({ min: 3, max: 5 }),
            title: faker.lorem.words(3),
            comment: faker.lorem.paragraph(),
            categories: { cleanliness: 4, comfort: 5, location: 4, facilities: 4, staff: 5, valueForMoney: 4 }
        });
    }

    // Insert Reviews
    for (let i = 0; i < reviewsData.length; i += BATCH_SIZE) {
      const batch = reviewsData.slice(i, i + BATCH_SIZE);
      await SqlReview.bulkCreate(batch);
      await MongoReview.insertMany(batch.map(r => ({
          _id: r.mongoId, user: r.mongoUserId, hotel: r.mongoHotelId, booking: r.mongoBookingId,
          rating: r.rating, title: r.title, comment: r.comment, categories: r.categories
      })));
    }
    console.log(`✅ Reviews generated (${reviewsData.length})`);


    const timeTaken = ((Date.now() - startTime) / 1000 / 60).toFixed(2);
    console.log(`\n🎉 Massive Seeding Complete in ${timeTaken} minutes! 🎉`);
    console.log(`Data successfully poured into both Mongoose (MongoDB) & Sequelize (MySQL) engines.`);
    
    process.exit(0);
  } catch (error) {
    console.error('Seeding Error:', error);
    process.exit(1);
  }
};

massiveSeed();
