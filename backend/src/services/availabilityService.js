const Room = require('../models/Room');
const RoomInventory = require('../models/RoomInventory');
const { calculateDynamicPricing, enumerateStayDates, normalizeDate } = require('./pricingService');
const { expireStalePendingBookings } = require('./bookingLifecycleService');

const getRangeAvailabilityForRoom = async (room, checkIn, checkOut) => {
  const dates = enumerateStayDates(checkIn, checkOut).map((date) => normalizeDate(date));

  if (!dates.length) {
    return {
      availableCount: room.totalRooms,
      blockedCount: 0,
    };
  }

  const inventory = await RoomInventory.find({
    room: room._id,
    date: { $in: dates },
  }).lean();

  const inventoryMap = new Map(
    inventory.map((entry) => [normalizeDate(entry.date).toISOString(), entry])
  );

  let availableCount = room.totalRooms;

  for (const date of dates) {
    const key = date.toISOString();
    const entry = inventoryMap.get(key);
    const blockedCount = (entry?.heldCount || 0) + (entry?.confirmedCount || 0);
    const remaining = Math.max(0, room.totalRooms - blockedCount);
    availableCount = Math.min(availableCount, remaining);
  }

  return {
    availableCount,
    blockedCount: Math.max(0, room.totalRooms - availableCount),
  };
};

/**
 * Check room availability for a hotel within a date range
 */
const checkAvailability = async (hotelId, checkIn, checkOut, guests = 1) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  await expireStalePendingBookings();

  // Get all active rooms for the hotel
  const rooms = await Room.find({ hotel: hotelId, isActive: true });

  const availability = await Promise.all(
    rooms.map(async (room) => {
      const { availableCount } = await getRangeAvailabilityForRoom(room, checkInDate, checkOutDate);
      const isAvailable = availableCount > 0 && room.maxGuests >= guests;
      const dynamicPricing = calculateDynamicPricing({
        baseRate: room.pricePerNight,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      });

      return {
        roomId: room._id,
        title: room.title,
        type: room.type,
        pricePerNight: dynamicPricing.nightlyRate,
        basePricePerNight: room.pricePerNight,
        maxGuests: room.maxGuests,
        bedType: room.bedType,
        roomSize: room.roomSize,
        amenities: room.amenities,
        images: room.images,
        available: isAvailable,
        availableCount: Math.max(0, availableCount),
        totalRooms: room.totalRooms,
        dynamicPricing,
      };
    })
  );

  return availability;
};

/**
 * Check if a specific room is available for given dates
 */
const isRoomAvailable = async (roomId, checkIn, checkOut) => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  await expireStalePendingBookings();

  const room = await Room.findById(roomId);
  if (!room || !room.isActive) return false;

  const { availableCount } = await getRangeAvailabilityForRoom(room, checkInDate, checkOutDate);

  return availableCount > 0;
};

module.exports = { checkAvailability, isRoomAvailable };
