const request = require('supertest');
require('../dbSetup');
const app = require('../../src/app');
const Hotel = require('../../src/models/Hotel');
const User = require('../../src/models/User');

describe('Hotels API Integration Tests', () => {
  let adminToken;

  beforeEach(async () => {
    const adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'admin',
      isVerified: true,
    });

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'AdminPass123!' });
    adminToken = adminLogin.body.data.accessToken;

    await Hotel.create([
      {
        title: 'Test Hotel Mumbai',
        description: 'A beautiful hotel in Mumbai',
        address: { street: '123 Main St', city: 'Mumbai', state: 'Maharashtra', country: 'India', zipCode: '400001' },
        pricePerNight: 3000,
        rating: 4.5,
        type: 'hotel',
        totalRooms: 24,
        amenities: ['wifi', 'pool', 'parking'],
        images: [{ url: 'https://example.com/img1.jpg' }],
        createdBy: adminUser._id,
        isActive: true,
        isFeatured: true,
      },
      {
        title: 'Test Resort Goa',
        description: 'A beautiful resort in Goa',
        address: { street: '456 Beach Rd', city: 'Goa', state: 'Goa', country: 'India', zipCode: '403001' },
        pricePerNight: 5000,
        rating: 4.8,
        type: 'resort',
        totalRooms: 18,
        amenities: ['wifi', 'pool', 'spa'],
        images: [{ url: 'https://example.com/img2.jpg' }],
        createdBy: adminUser._id,
        isActive: true,
        isFeatured: false,
      },
      {
        title: 'Budget Inn Delhi',
        description: 'Affordable stay in Delhi',
        address: { street: '789 Budget St', city: 'Delhi', state: 'Delhi', country: 'India', zipCode: '110001' },
        pricePerNight: 1000,
        rating: 3.5,
        type: 'hotel',
        totalRooms: 32,
        amenities: ['wifi'],
        images: [],
        createdBy: adminUser._id,
        isActive: true,
        isFeatured: false,
      },
    ]);
  });

  describe('GET /api/v1/hotels', () => {
    it('should return all active hotels with pagination', async () => {
      const res = await request(app)
        .get('/api/v1/hotels')
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.hotels).toHaveLength(3);
      expect(res.body.data.totalResults).toBe(3);
      expect(res.body.data.currentPage).toBe(1);
    });

    it('should filter hotels by city', async () => {
      const res = await request(app)
        .get('/api/v1/hotels?city=Mumbai')
        .expect(200);

      expect(res.body.data.hotels).toHaveLength(1);
      expect(res.body.data.hotels[0].title).toContain('Mumbai');
    });

    it('should filter by price range', async () => {
      const res = await request(app)
        .get('/api/v1/hotels?minPrice=2000&maxPrice=4000')
        .expect(200);

      expect(res.body.data.hotels).toHaveLength(1);
      expect(res.body.data.hotels[0].pricePerNight).toBe(3000);
    });
  });

  describe('GET /api/v1/hotels/featured', () => {
    it('should return only featured hotels', async () => {
      const res = await request(app)
        .get('/api/v1/hotels/featured')
        .expect(200);

      expect(res.body.data.hotels).toHaveLength(1);
      expect(res.body.data.hotels[0].isFeatured).toBe(true);
    });
  });

  describe('GET /api/v1/hotels/:idOrSlug', () => {
    it('should get hotel by ID', async () => {
      const hotels = await Hotel.find();
      const hotelId = hotels[0]._id.toString();

      const res = await request(app)
        .get(`/api/v1/hotels/${hotelId}`)
        .expect(200);

      expect(res.body.data.hotel._id).toBe(hotelId);
    });
  });

  describe('POST /api/v1/hotels', () => {
    const newHotel = {
      title: 'Brand New Hotel',
      description: 'A brand new hotel',
      address: { street: '1 New St', city: 'Chennai', state: 'TN', country: 'India', zipCode: '600001' },
      pricePerNight: 2500,
      type: 'hotel',
      totalRooms: 12,
      amenities: ['wifi', 'gym'],
    };

    it('should create hotel as admin', async () => {
      const res = await request(app)
        .post('/api/v1/hotels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newHotel)
        .expect(201);

      expect(res.body.data.hotel.title).toBe('Brand New Hotel');
    });

    it('should reject hotel creation without auth', async () => {
      await request(app)
        .post('/api/v1/hotels')
        .send(newHotel)
        .expect(401);
    });
  });
});
