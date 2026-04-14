const request = require('supertest');
require('../dbSetup');
const app = require('../../src/app');
const Hotel = require('../../src/models/Hotel');
const Room = require('../../src/models/Room');
const User = require('../../src/models/User');

describe('Bookings API Integration Tests', () => {
  let userToken;
  let hotelId;
  let roomId;

  beforeEach(async () => {
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      isVerified: true,
    });

    const hotel = await Hotel.create({
      title: 'Booking Test Hotel',
      description: 'Hotel for booking tests',
      address: { street: '1 Test St', city: 'Test City', state: 'TS', country: 'India', zipCode: '100001' },
      pricePerNight: 2000,
      rating: 4.0,
      type: 'hotel',
      totalRooms: 16,
      amenities: ['wifi'],
      images: [{ url: 'https://example.com/img.jpg' }],
      createdBy: admin._id,
      isActive: true,
    });
    hotelId = hotel._id.toString();

    const room = await Room.create({
      hotel: hotel._id,
      title: 'Deluxe Room',
      type: 'deluxe',
      pricePerNight: 2000,
      maxGuests: 2,
      bedType: 'king',
      amenities: ['wifi', 'tv'],
      totalRooms: 4,
      isActive: true,
    });
    roomId = room._id.toString();

    await User.create({
      name: 'Booker',
      email: 'booker@test.com',
      password: 'BookerPass123!',
      isVerified: true,
      role: 'user',
    });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'booker@test.com', password: 'BookerPass123!' })
      .expect(200);

    userToken = loginRes.body.data.accessToken;
  });

  describe('POST /api/v1/bookings', () => {
    it('should create a booking successfully', async () => {
      const checkIn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const checkOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotel: hotelId,
          room: roomId,
          checkIn,
          checkOut,
          guests: { adults: 2, children: 0 },
          guestDetails: { name: 'John Doe', email: 'john@test.com', phone: '9876543210' },
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.booking).toBeDefined();
      expect(String(res.body.data.booking.hotel)).toBe(hotelId);
      expect(String(res.body.data.booking.room)).toBe(roomId);
    });

    it('should reject booking without authentication', async () => {
      const checkIn = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const checkOut = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      await request(app)
        .post('/api/v1/bookings')
        .send({ hotel: hotelId, room: roomId, checkIn, checkOut })
        .expect(401);
    });

    it('should reject booking with a past check-in date', async () => {
      const res = await request(app)
        .post('/api/v1/bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          hotel: hotelId,
          room: roomId,
          checkIn: '2020-01-01',
          checkOut: '2020-01-05',
          guests: { adults: 1 },
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'checkIn',
            message: expect.stringContaining('past'),
          }),
        ])
      );
    });
  });

  describe('GET /api/v1/bookings/my-bookings', () => {
    it('should return user bookings', async () => {
      const res = await request(app)
        .get('/api/v1/bookings/my-bookings')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.bookings)).toBe(true);
    });
  });
});
