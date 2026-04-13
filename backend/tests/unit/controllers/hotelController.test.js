// Mock dependencies
jest.mock('../../../src/models/Hotel');
jest.mock('../../../src/models/Room');
jest.mock('../../../src/services/availabilityService');
jest.mock('../../../src/config/cloudinary');

const Hotel = require('../../../src/models/Hotel');
const Room = require('../../../src/models/Room');

const {
  getHotels, getFeaturedHotels, getHotel, createHotel, updateHotel, deleteHotel,
} = require('../../../src/controllers/hotelController');

// asyncHandler doesn't return the inner promise — flush microtasks after calling
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const createMocks = (query = {}, params = {}, body = {}, user = null) => {
  const req = { query, params, body, user, files: [] };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe('HotelController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHotels', () => {
    it('should return paginated hotel list', async () => {
      const mockHotels = [
        { _id: 'h1', title: 'Hotel A', rating: 4.5 },
        { _id: 'h2', title: 'Hotel B', rating: 4.0 },
      ];

      Hotel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockHotels),
      });
      Hotel.countDocuments.mockResolvedValue(2);

      const { req, res, next } = createMocks({ page: '1', limit: '12' });

      getHotels(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.hotels).toHaveLength(2);
      expect(responseData.data.totalResults).toBe(2);
    });

    it('should apply city filter', async () => {
      Hotel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Hotel.countDocuments.mockResolvedValue(0);

      const { req, res, next } = createMocks({ city: 'Mumbai' });

      getHotels(req, res, next);
      await flushPromises();

      expect(Hotel.find).toHaveBeenCalled();
      const queryArg = Hotel.find.mock.calls[0][0];
      expect(queryArg['address.city']).toEqual({ $regex: 'Mumbai', $options: 'i' });
    });

    it('should apply price range filter', async () => {
      Hotel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue([]),
      });
      Hotel.countDocuments.mockResolvedValue(0);

      const { req, res, next } = createMocks({ minPrice: '1000', maxPrice: '5000' });

      getHotels(req, res, next);
      await flushPromises();

      const queryArg = Hotel.find.mock.calls[0][0];
      expect(queryArg.pricePerNight.$gte).toBe(1000);
      expect(queryArg.pricePerNight.$lte).toBe(5000);
    });
  });

  describe('getFeaturedHotels', () => {
    it('should return featured hotels sorted by rating', async () => {
      const mockFeatured = [{ _id: 'h1', title: 'Featured Hotel', isFeatured: true, rating: 5 }];

      Hotel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockFeatured),
      });

      const { req, res, next } = createMocks();

      getFeaturedHotels(req, res, next);
      await flushPromises();

      expect(Hotel.find).toHaveBeenCalledWith({ isActive: true, isFeatured: true });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });

  describe('getHotel', () => {
    it('should get hotel by ObjectId', async () => {
      const mockHotel = { _id: '507f1f77bcf86cd799439011', title: 'Test Hotel', isActive: true };

      Hotel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockHotel),
      });
      Room.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const { req, res, next } = createMocks({}, { idOrSlug: '507f1f77bcf86cd799439011' });

      getHotel(req, res, next);
      await flushPromises();

      expect(Hotel.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should get hotel by slug', async () => {
      const mockHotel = { _id: 'h1', slug: 'test-hotel', title: 'Test Hotel', isActive: true };

      Hotel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockHotel),
      });
      Room.find.mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      });

      const { req, res, next } = createMocks({}, { idOrSlug: 'test-hotel' });

      getHotel(req, res, next);
      await flushPromises();

      expect(Hotel.findOne).toHaveBeenCalledWith({ slug: 'test-hotel' });
    });

    it('should throw 404 if hotel not found', async () => {
      Hotel.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const { req, res, next } = createMocks({}, { idOrSlug: '507f1f77bcf86cd799439011' });

      getHotel(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });
  });

  describe('createHotel', () => {
    it('should create hotel and set createdBy from auth user', async () => {
      const mockHotel = { _id: 'h1', title: 'New Hotel' };
      Hotel.create.mockResolvedValue(mockHotel);

      const { req, res, next } = createMocks(
        {}, {}, { title: 'New Hotel', description: 'Nice place' },
        { _id: 'admin123' }
      );

      createHotel(req, res, next);
      await flushPromises();

      expect(req.body.createdBy).toBe('admin123');
      expect(Hotel.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  describe('updateHotel', () => {
    it('should update hotel', async () => {
      const mockHotel = { _id: 'h1', title: 'Updated Hotel' };
      Hotel.findById.mockResolvedValue(mockHotel);
      Hotel.findByIdAndUpdate.mockResolvedValue({ ...mockHotel, title: 'Updated Hotel' });

      const { req, res, next } = createMocks({}, { id: 'h1' }, { title: 'Updated Hotel' });

      updateHotel(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should throw 404 if hotel not found for update', async () => {
      Hotel.findById.mockResolvedValue(null);

      const { req, res, next } = createMocks({}, { id: 'nonexistent' }, { title: 'Update' });

      updateHotel(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });
  });

  describe('deleteHotel', () => {
    it('should soft-delete hotel by setting isActive to false', async () => {
      const mockHotel = { _id: 'h1', isActive: true, save: jest.fn().mockResolvedValue(true) };
      Hotel.findById.mockResolvedValue(mockHotel);

      const { req, res, next } = createMocks({}, { id: 'h1' });

      deleteHotel(req, res, next);
      await flushPromises();

      expect(mockHotel.isActive).toBe(false);
      expect(mockHotel.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should throw 404 if hotel not found for deletion', async () => {
      Hotel.findById.mockResolvedValue(null);

      const { req, res, next } = createMocks({}, { id: 'nonexistent' });

      deleteHotel(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });
  });
});
