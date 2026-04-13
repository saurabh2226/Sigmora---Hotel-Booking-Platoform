// Mock dependencies
jest.mock('../../../src/models/Booking');
jest.mock('../../../src/models/Room');
jest.mock('../../../src/models/Hotel');
jest.mock('../../../src/models/Coupon');
jest.mock('../../../src/services/availabilityService');
jest.mock('../../../src/services/notificationService');
jest.mock('../../../src/services/emailService');
jest.mock('../../../src/socket/socketHandler');

const Booking = require('../../../src/models/Booking');
const Room = require('../../../src/models/Room');
const Hotel = require('../../../src/models/Hotel');
const { isRoomAvailable } = require('../../../src/services/availabilityService');
const { emitAvailabilityUpdate } = require('../../../src/socket/socketHandler');

const {
  createBooking, getMyBookings, getBooking, cancelBooking,
} = require('../../../src/controllers/bookingController');

// asyncHandler doesn't return the inner promise — flush microtasks after calling
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

const createMocks = (body = {}, params = {}, query = {}, user = null) => {
  const req = { body, params, query, user };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe('BookingController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emitAvailabilityUpdate.mockImplementation(() => {});
  });

  describe('createBooking', () => {
    it('should create a booking successfully', async () => {
      const futureCheckIn = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureCheckOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      Hotel.findById.mockResolvedValue({ _id: 'hotel1', isActive: true });
      Room.findById.mockResolvedValue({
        _id: 'room1',
        hotel: 'hotel1',
        isActive: true,
        pricePerNight: 2000,
      });
      isRoomAvailable.mockResolvedValue(true);
      Booking.create.mockResolvedValue({
        _id: 'booking1',
        user: 'user1',
        hotel: 'hotel1',
        room: 'room1',
        status: 'pending',
      });

      const { req, res, next } = createMocks(
        { hotel: 'hotel1', room: 'room1', checkIn: futureCheckIn, checkOut: futureCheckOut, guests: { adults: 2, children: 0 } },
        {}, {},
        { _id: 'user1' }
      );

      createBooking(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(201);
      expect(Booking.create).toHaveBeenCalled();
    });

    it('should throw 400 if check-out is before check-in', async () => {
      const { req, res, next } = createMocks(
        { hotel: 'h1', room: 'r1', checkIn: '2026-12-25', checkOut: '2026-12-20' },
        {}, {},
        { _id: 'user1' }
      );

      createBooking(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('should throw 404 if hotel not found', async () => {
      Hotel.findById.mockResolvedValue(null);

      const futureCheckIn = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureCheckOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const { req, res, next } = createMocks(
        { hotel: 'h1', room: 'r1', checkIn: futureCheckIn, checkOut: futureCheckOut },
        {}, {},
        { _id: 'user1' }
      );

      createBooking(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });

    it('should throw 400 if room is not available', async () => {
      Hotel.findById.mockResolvedValue({ _id: 'h1', isActive: true });
      Room.findById.mockResolvedValue({
        _id: 'r1',
        hotel: 'h1',
        isActive: true,
        pricePerNight: 2000,
      });
      isRoomAvailable.mockResolvedValue(false);

      const futureCheckIn = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureCheckOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const { req, res, next } = createMocks(
        { hotel: 'h1', room: 'r1', checkIn: futureCheckIn, checkOut: futureCheckOut },
        {}, {},
        { _id: 'user1' }
      );

      createBooking(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });

    it('should throw 400 if the selected room belongs to another hotel', async () => {
      Hotel.findById.mockResolvedValue({ _id: 'h1', isActive: true });
      Room.findById.mockResolvedValue({
        _id: 'r1',
        hotel: 'another_hotel',
        isActive: true,
        pricePerNight: 2000,
      });

      const futureCheckIn = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      const futureCheckOut = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const { req, res, next } = createMocks(
        { hotel: 'h1', room: 'r1', checkIn: futureCheckIn, checkOut: futureCheckOut },
        {}, {},
        { _id: 'user1' }
      );

      createBooking(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Selected room does not belong to this hotel');
    });
  });

  describe('getMyBookings', () => {
    it('should return paginated bookings for current user', async () => {
      const mockBookings = [
        { _id: 'b1', hotel: { title: 'Hotel A' }, status: 'confirmed' },
      ];

      Booking.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        lean: jest.fn().mockResolvedValue(mockBookings),
      });
      Booking.countDocuments.mockResolvedValue(1);

      const { req, res, next } = createMocks({}, {}, { page: '1', limit: '10' }, { _id: 'user1' });

      getMyBookings(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
      const responseData = res.json.mock.calls[0][0];
      expect(responseData.data.bookings).toHaveLength(1);
    });
  });

  describe('getBooking', () => {
    it('should return booking for owner', async () => {
      const mockBooking = {
        _id: 'b1',
        user: { _id: 'user1', toString: () => 'user1' },
      };

      Booking.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(mockBooking),
          }),
        }),
      });

      const { req, res, next } = createMocks(
        {}, { id: 'b1' }, {},
        { _id: 'user1', role: 'user', toString: () => 'user1' }
      );
      // Make the _id comparable
      req.user._id = { toString: () => 'user1' };

      getBooking(req, res, next);
      await flushPromises();

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should throw 404 if booking not found', async () => {
      Booking.findById.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockReturnValue({
            populate: jest.fn().mockResolvedValue(null),
          }),
        }),
      });

      const { req, res, next } = createMocks({}, { id: 'nonexistent' }, {}, { _id: 'user1', role: 'user' });

      getBooking(req, res, next);
      await flushPromises();

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });
  });
});
