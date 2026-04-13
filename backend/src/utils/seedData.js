require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const Coupon = require('../models/Coupon');
const RoomInventory = require('../models/RoomInventory');
const { calculateDynamicPricing, enumerateStayDates, normalizeDate } = require('../services/pricingService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hotel-booking';
const TOTAL_HOTELS = 100;
const SEED_PENDING_HOLD_DAYS = Number(process.env.SEED_PENDING_HOLD_DAYS || 120);

const cities = [
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777 },
  { city: 'Delhi', state: 'Delhi', lat: 28.6139, lng: 77.209 },
  { city: 'Bangalore', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { city: 'Goa', state: 'Goa', lat: 15.2993, lng: 74.124 },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { city: 'Udaipur', state: 'Rajasthan', lat: 24.5854, lng: 73.7125 },
  { city: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  { city: 'Manali', state: 'Himachal Pradesh', lat: 32.2396, lng: 77.1887 },
  { city: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { city: 'Pondicherry', state: 'Puducherry', lat: 11.9416, lng: 79.8083 },
  { city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.3176, lng: 82.9739 },
  { city: 'Amritsar', state: 'Punjab', lat: 31.634, lng: 74.8723 },
  { city: 'Rishikesh', state: 'Uttarakhand', lat: 30.0869, lng: 78.2676 },
  { city: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  { city: 'Mysore', state: 'Karnataka', lat: 12.2958, lng: 76.6394 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { city: 'Darjeeling', state: 'West Bengal', lat: 27.041, lng: 88.2663 },
];

const hotelPrefixes = [
  'Aurora', 'Skyline', 'Serenity', 'Grand', 'Saffron', 'Harbor', 'Maple', 'Verdant', 'Monarch', 'Azure',
  'Cedar', 'Lotus', 'Regal', 'Sunlit', 'Opal', 'Willow', 'Palm', 'Pearl', 'Summit', 'Ivory',
];

const hotelNouns = [
  'Suites', 'Retreat', 'Residency', 'Escape', 'Stay', 'Palace', 'Haven', 'House', 'Deck', 'Gardens',
  'Point', 'Lodge', 'Terrace', 'Court', 'Club', 'Harbor', 'Nest', 'Collection', 'Bay', 'Vista',
];

const hotelTypes = ['hotel', 'resort', 'villa', 'apartment', 'hostel', 'guesthouse'];
const amenitiesList = ['wifi', 'parking', 'pool', 'gym', 'spa', 'restaurant', 'bar', 'room-service', 'laundry', 'ac', 'tv', 'breakfast', 'pet-friendly', 'ev-charging', 'business-center', 'concierge'];
const roomTypes = ['single', 'double', 'suite', 'deluxe', 'penthouse'];
const bedTypes = ['single', 'double', 'queen', 'king', 'twin'];
const HOTEL_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1551776235-dde6d4829808?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&h=800',
];
const ROOM_IMAGE_POOL = [
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693539155-4f7c0c5e90a3?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&h=700&sat=-8',
  'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&h=800&bri=-3',
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1100&h=780&con=5',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1000&h=760&vib=8',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=980&h=720&exp=5',
  'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&h=800',
  'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1180&h=790&sat=10',
];
const HOTEL_IMAGE_CAPTIONS = ['Exterior', 'Lobby', 'Signature Room', 'Amenities Deck', 'Pool View', 'Sunset Lounge'];
const ROOM_IMAGE_CAPTIONS = ['Room View', 'Bed Setup', 'Seating Corner', 'Bathroom Detail'];

const getRandomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

const buildImageSet = (imagePool, seed, count, captions) => Array.from({ length: count }, (_, index) => {
  const poolIndex = (seed + (index * 3)) % imagePool.length;
  return {
    url: imagePool[poolIndex],
    caption: captions[index % captions.length],
  };
});

const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const roundCurrency = (value) => Math.round(value * 100) / 100;

const buildInventoryDocuments = (bookings) => {
  const inventoryMap = new Map();

  bookings.forEach((booking) => {
    const dates = enumerateStayDates(booking.checkIn, booking.checkOut).map((date) => normalizeDate(date));
    const isActivePendingHold = booking.status === 'pending'
      && booking.payment?.status === 'pending'
      && booking.holdExpiresAt
      && new Date(booking.holdExpiresAt) > new Date();
    const isConfirmedInventory = ['confirmed', 'checked-in'].includes(booking.status);

    if (!isActivePendingHold && !isConfirmedInventory) {
      return;
    }

    dates.forEach((date) => {
      const key = `${booking.room.toString()}-${date.toISOString()}`;
      const existing = inventoryMap.get(key) || {
        hotel: booking.hotel,
        room: booking.room,
        date,
        heldCount: 0,
        confirmedCount: 0,
      };

      if (isActivePendingHold) {
        existing.heldCount += 1;
      }
      if (isConfirmedInventory) {
        existing.confirmedCount += 1;
      }

      inventoryMap.set(key, existing);
    });
  });

  return Array.from(inventoryMap.values());
};

const seedData = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await Promise.all([
      User.deleteMany({}),
      Hotel.deleteMany({}),
      Room.deleteMany({}),
      Booking.deleteMany({}),
      Review.deleteMany({}),
      Coupon.deleteMany({}),
      RoomInventory.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@hotelbooking.com',
      password: 'Admin@123',
      role: 'admin',
      isVerified: true,
      phone: '+919876543210',
    });
    console.log('Created admin user: admin@hotelbooking.com / Admin@123');

    const supportAdmin = await User.create({
      name: 'Saurabh Admin',
      email: 'saurabhccs11@gmail.com',
      password: 'Password@123',
      role: 'admin',
      isVerified: true,
      phone: '+919811111111',
    });
    const adminPool = [adminUser, supportAdmin];
    console.log('Created 2 admin accounts');

    const users = [];
    for (let i = 1; i <= 12; i += 1) {
      const user = await User.create({
        name: `User ${i}`,
        email: `user${i}@test.com`,
        password: 'User@123',
        role: 'user',
        isVerified: true,
        phone: `+9199000${String(10000 + i)}`,
      });
      users.push(user);
    }
    console.log('Created 12 regular users');

    const hotels = [];
    for (let i = 0; i < TOTAL_HOTELS; i += 1) {
      const cityData = cities[i % cities.length];
      const owner = adminPool[i % adminPool.length];
      const isLowPriceHotel = i === 0 || i === 1;
      const basePrice = isLowPriceHotel ? (i === 0 ? 2 : 1) : getRandomInt(18, 260) * 100;
      const title = isLowPriceHotel
        ? i === 0
          ? 'Checkout Test Corner'
          : 'Sandbox Rupee Retreat'
        : `${hotelPrefixes[i % hotelPrefixes.length]} ${hotelNouns[Math.floor(i / hotelPrefixes.length) % hotelNouns.length]} ${cityData.city}`;

      const hotel = await Hotel.create({
        title,
        description: `${title} is a ${hotelTypes[i % hotelTypes.length]} crafted for travelers visiting ${cityData.city}. Expect curated local design, reliable work-friendly amenities, and a guest experience shaped around business trips, family stays, weekend getaways, and premium leisure escapes.`,
        type: hotelTypes[i % hotelTypes.length],
        address: {
          street: `${getRandomInt(1, 999)} ${['Palm', 'Lake', 'Fort', 'Market', 'Temple', 'Beach'][i % 6]} Road`,
          city: cityData.city,
          state: cityData.state,
          country: 'India',
          zipCode: `${getRandomInt(100000, 999999)}`,
          coordinates: {
            lat: cityData.lat + (Math.random() - 0.5) * 0.08,
            lng: cityData.lng + (Math.random() - 0.5) * 0.08,
          },
        },
        images: buildImageSet(HOTEL_IMAGE_POOL, i * 2, 6, HOTEL_IMAGE_CAPTIONS),
        amenities: getRandomItems(amenitiesList, getRandomInt(6, 11)),
        policies: {
          checkInTime: '14:00',
          checkOutTime: '11:00',
          cancellation: ['free', 'moderate', 'strict'][i % 3],
          petsAllowed: i % 5 === 0,
          smokingAllowed: false,
        },
        contact: {
          phone: `+91${getRandomInt(7000000000, 9999999999)}`,
          email: `${title.toLowerCase().replace(/[^a-z0-9]+/g, '')}@sigmora-demo.com`,
        },
        rating: Math.round((3.4 + Math.random() * 1.5) * 10) / 10,
        totalReviews: getRandomInt(10, 240),
        pricePerNight: basePrice,
        maxGuests: getRandomInt(2, 6),
        totalRooms: getRandomInt(18, 120),
        isFeatured: i < 12,
        isActive: true,
        createdBy: owner._id,
      });

      hotels.push(hotel);
    }
    console.log(`Created ${TOTAL_HOTELS} hotels`);

    const rooms = [];
    for (const [index, hotel] of hotels.entries()) {
      const isLowPriceHotel = index === 0 || index === 1;
      const roomCount = isLowPriceHotel ? 3 : getRandomInt(3, 5);

      for (let roomIndex = 0; roomIndex < roomCount; roomIndex += 1) {
        const roomType = roomTypes[roomIndex % roomTypes.length];
        const priceMultiplier = { single: 0.85, double: 1, suite: 1.35, deluxe: 1.7, penthouse: 2.2 };
        const baseRate = isLowPriceHotel
          ? (index === 0 ? [2, 3, 4][roomIndex] : [1, 2, 3][roomIndex])
          : Math.max(499, Math.round(hotel.pricePerNight * (priceMultiplier[roomType] || 1)));

        const room = await Room.create({
          hotel: hotel._id,
          title: isLowPriceHotel
            ? `Test ${roomType.charAt(0).toUpperCase() + roomType.slice(1)} Room`
            : `${roomType.charAt(0).toUpperCase() + roomType.slice(1)} ${['Hideaway', 'Studio', 'Suite', 'Wing'][roomIndex % 4]}`,
          type: roomType,
          pricePerNight: baseRate,
          maxGuests: roomType === 'single' ? 1 : roomType === 'double' ? 2 : roomType === 'suite' ? 3 : 4,
          bedType: bedTypes[roomIndex % bedTypes.length],
          roomSize: getRandomInt(180, 920),
          images: buildImageSet(ROOM_IMAGE_POOL, (index * 4) + roomIndex, 4, ROOM_IMAGE_CAPTIONS),
          amenities: getRandomItems(['wifi', 'ac', 'tv', 'minibar', 'safe', 'balcony', 'work-desk', 'bathtub'], 5),
          totalRooms: isLowPriceHotel ? 4 : getRandomInt(4, 18),
          isActive: true,
        });
        rooms.push(room);
      }
    }
    console.log(`Created ${rooms.length} rooms`);

    const bookings = [];
    const bookingStatuses = ['confirmed', 'checked-out', 'cancelled', 'pending'];

    for (let i = 0; i < 90; i += 1) {
      const user = users[i % users.length];
      const hotel = hotels[i % hotels.length];
      const hotelRooms = rooms.filter((room) => room.hotel.toString() === hotel._id.toString());
      const room = hotelRooms[i % hotelRooms.length];
      const status = bookingStatuses[i % bookingStatuses.length];

      const baseDate = new Date();
      if (status === 'checked-out' || status === 'cancelled') {
        baseDate.setDate(baseDate.getDate() - getRandomInt(10, 90));
      } else {
        baseDate.setDate(baseDate.getDate() + getRandomInt(2, 60));
      }

      const checkIn = new Date(baseDate);
      const nights = getRandomInt(1, 6);
      const checkOut = new Date(checkIn);
      checkOut.setDate(checkOut.getDate() + nights);

      const pricing = calculateDynamicPricing({
        baseRate: room.pricePerNight,
        checkIn,
        checkOut,
      });

      const booking = await Booking.create({
        user: user._id,
        hotel: hotel._id,
        room: room._id,
        checkIn,
        checkOut,
        guests: { adults: getRandomInt(1, Math.min(3, room.maxGuests)), children: getRandomInt(0, 2) },
        guestDetails: {
          name: user.name,
          email: user.email,
          phone: user.phone,
        },
        pricing,
        payment: {
          method: 'razorpay',
          transactionId: `txn_seed_${Date.now()}_${i}`,
          status: status === 'pending'
            ? 'pending'
            : status === 'cancelled' && i % 2 === 0
              ? 'partial_refunded'
              : 'completed',
          paidAt: status === 'pending' ? undefined : new Date(),
          refundedAt: status === 'cancelled' && i % 2 === 0 ? new Date() : undefined,
          refundId: status === 'cancelled' && i % 2 === 0 ? `rfnd_seed_${i}` : undefined,
        },
        status,
        // Keep seeded pending bookings stable for demos so cleanup jobs do not wipe them within minutes.
        holdExpiresAt: status === 'pending'
          ? new Date(Date.now() + (SEED_PENDING_HOLD_DAYS * 24 * 60 * 60 * 1000))
          : undefined,
        refundAmount: status === 'cancelled' && i % 2 === 0 ? roundCurrency(pricing.totalPrice * 0.5) : 0,
        cancelledAt: status === 'cancelled' ? new Date() : undefined,
        cancellationReason: status === 'cancelled' ? 'Guest cancelled during seed setup' : undefined,
      });

      bookings.push(booking);
    }
    console.log(`Created ${bookings.length} bookings`);

    const inventoryDocuments = buildInventoryDocuments(bookings);
    if (inventoryDocuments.length) {
      await RoomInventory.insertMany(inventoryDocuments);
    }
    console.log(`Created ${inventoryDocuments.length} room inventory rows`);

    const completedBookings = bookings.filter((booking) => booking.status === 'checked-out');
    const reviewSamples = [
      { title: 'Great stay!', comment: 'Comfortable rooms, quick check-in, and a polished experience overall.' },
      { title: 'Would visit again', comment: 'Loved the staff support and the location felt perfect for exploring the city.' },
      { title: 'Solid value', comment: 'A reliable stay with clean rooms and good amenities for the price point.' },
      { title: 'Perfect short getaway', comment: 'The ambience and amenities made this an easy recommendation for couples.' },
      { title: 'Excellent owner support', comment: 'Questions were answered quickly and the property felt thoughtfully managed.' },
    ];

    for (let i = 0; i < Math.min(60, completedBookings.length); i += 1) {
      const booking = completedBookings[i];
      const sample = reviewSamples[i % reviewSamples.length];

      await Review.create({
        user: booking.user,
        hotel: booking.hotel,
        booking: booking._id,
        rating: getRandomInt(3, 5),
        title: sample.title,
        comment: sample.comment,
        categories: {
          cleanliness: getRandomInt(3, 5),
          comfort: getRandomInt(3, 5),
          location: getRandomInt(3, 5),
          facilities: getRandomInt(3, 5),
          staff: getRandomInt(3, 5),
          valueForMoney: getRandomInt(3, 5),
        },
        isVerified: i % 2 === 0,
      });
    }
    console.log('Created reviews');

    const coupons = [
      {
        title: 'Welcome savings',
        description: 'A platform-wide first stay offer for new guests.',
        bannerText: 'Welcome deal: save 10% on your next stay',
        bannerColor: '#0f766e',
        code: 'WELCOME10',
        discountType: 'percentage',
        discountValue: 10,
        minBookingAmount: 1200,
        maxDiscount: 1000,
        validUntil: new Date('2028-12-31'),
        createdBy: adminUser._id,
      },
      {
        title: 'Weekend mini break',
        description: 'Ideal for quick weekend trips on one curated hotel.',
        bannerText: 'Weekend escape: save 20%',
        bannerColor: '#f59e0b',
        code: 'SUMMER20',
        discountType: 'percentage',
        discountValue: 20,
        minBookingAmount: 2500,
        maxDiscount: 2500,
        validUntil: new Date('2028-08-31'),
        hotel: hotels[3]._id,
        createdBy: hotels[3].createdBy,
      },
      {
        title: 'First stay boost',
        description: 'A high-visibility coupon for demos and early adopters.',
        bannerText: 'Special first stay: 50% off',
        bannerColor: '#dc2626',
        code: 'FIRST50',
        discountType: 'percentage',
        discountValue: 50,
        minBookingAmount: 1000,
        maxDiscount: 2000,
        usageLimit: 100,
        validUntil: new Date('2028-06-30'),
        createdBy: adminUser._id,
      },
      {
        title: 'Flat savings',
        description: 'Easy flat rupee discount for straightforward testing.',
        bannerText: 'Flat ₹500 off selected stays',
        bannerColor: '#2563eb',
        code: 'FLAT500',
        discountType: 'flat',
        discountValue: 500,
        minBookingAmount: 1500,
        validUntil: new Date('2028-12-31'),
        hotel: hotels[8]._id,
        createdBy: hotels[8].createdBy,
      },
      {
        title: 'Owner special',
        description: 'Hotel-specific owner-managed campaign for short getaways.',
        bannerText: 'Owner special: 15% off this hotel',
        bannerColor: '#7c3aed',
        code: 'WEEKEND15',
        discountType: 'percentage',
        discountValue: 15,
        minBookingAmount: 1800,
        maxDiscount: 2200,
        validUntil: new Date('2028-12-31'),
        hotel: hotels[12]._id,
        createdBy: hotels[12].createdBy,
      },
    ];
    await Coupon.insertMany(coupons);
    console.log('Created 5 coupons');

    console.log('\n✅ Seed data created successfully!');
    console.log('\nLogin credentials:');
    console.log('Admin: admin@hotelbooking.com / Admin@123');
    console.log('Seeded admin: saurabhccs11@gmail.com / Password@123');
    console.log('Users: user1@test.com to user12@test.com / User@123');
    console.log('\nLow-price payment test hotels:');
    console.log('- Checkout Test Corner');
    console.log('- Sandbox Rupee Retreat');
    console.log('\nCoupons: WELCOME10, SUMMER20, FIRST50, FLAT500, WEEKEND15\n');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
