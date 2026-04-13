const Booking = require('../models/Booking');
const RoomInventory = require('../models/RoomInventory');
const { enumerateStayDates, normalizeDate } = require('./pricingService');
const { withLock } = require('./distributedLockService');

const HOLD_WINDOW_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES || 10);
const ROOM_LOCK_PREFIX = 'room-booking-lock';

const getHoldExpiryDate = (reference = new Date()) => {
  const expiry = new Date(reference);
  expiry.setMinutes(expiry.getMinutes() + HOLD_WINDOW_MINUTES);
  return expiry;
};

const getStayDates = (bookingOrRange, maybeCheckOut) => {
  if (bookingOrRange?.checkIn && bookingOrRange?.checkOut) {
    return enumerateStayDates(bookingOrRange.checkIn, bookingOrRange.checkOut);
  }

  return enumerateStayDates(bookingOrRange, maybeCheckOut);
};

const ensureInventoryDoc = async ({ roomId, hotelId, date }) => {
  await RoomInventory.updateOne(
    { room: roomId, date },
    {
      $setOnInsert: {
        room: roomId,
        hotel: hotelId,
        date,
      },
    },
    { upsert: true }
  );
};

const cleanupZeroInventory = async ({ roomId, dates }) => {
  if (!dates.length) return;

  await RoomInventory.deleteMany({
    room: roomId,
    date: { $in: dates },
    heldCount: { $lte: 0 },
    confirmedCount: { $lte: 0 },
  });
};

const getRoomLockKey = (roomId) => `${ROOM_LOCK_PREFIX}:${roomId.toString()}`;

const acquireRoomHold = async ({ room, hotelId, checkIn, checkOut }) => {
  const dates = getStayDates(checkIn, checkOut).map((date) => normalizeDate(date));
  const roomId = room._id || room;

  return withLock(getRoomLockKey(roomId), {}, async () => {
    const acquiredDates = [];

    try {
      for (const date of dates) {
        await ensureInventoryDoc({ roomId, hotelId, date });

        const inventory = await RoomInventory.findOneAndUpdate(
          {
            room: roomId,
            date,
            $expr: {
              $lt: [
                { $add: ['$heldCount', '$confirmedCount'] },
                room.totalRooms,
              ],
            },
          },
          { $inc: { heldCount: 1 } },
          { new: true }
        );

        if (!inventory) {
          throw new Error('ROOM_UNAVAILABLE');
        }

        acquiredDates.push(date);
      }

      return {
        holdExpiresAt: getHoldExpiryDate(),
        dates,
      };
    } catch (error) {
      if (acquiredDates.length) {
        await Promise.all(
          acquiredDates.map((date) =>
            RoomInventory.updateOne(
              { room: roomId, date, heldCount: { $gt: 0 } },
              { $inc: { heldCount: -1 } }
            )
          )
        );
        await cleanupZeroInventory({ roomId, dates: acquiredDates });
      }

      throw error;
    }
  });
};

const adjustInventoryCounts = async ({
  booking,
  heldDelta = 0,
  confirmedDelta = 0,
  source = 'hold',
  requireMatch = false,
}) => {
  const dates = getStayDates(booking).map((date) => normalizeDate(date));
  const roomId = booking.room._id || booking.room;
  const hotelId = booking.hotel._id || booking.hotel;

  return withLock(getRoomLockKey(roomId), {}, async () => {
    const processedDates = [];

    try {
      for (const date of dates) {
        if (heldDelta > 0 || confirmedDelta > 0) {
          await ensureInventoryDoc({ roomId, hotelId, date });
        }

        const query = { room: roomId, date };
        if (heldDelta < 0) {
          query.heldCount = { $gte: Math.abs(heldDelta) };
        }
        if (confirmedDelta < 0) {
          query.confirmedCount = { $gte: Math.abs(confirmedDelta) };
        }

        const result = await RoomInventory.updateOne(query, {
          $inc: {
            heldCount: heldDelta,
            confirmedCount: confirmedDelta,
          },
        });

        if (!result.matchedCount && (heldDelta < 0 || confirmedDelta < 0)) {
          if (requireMatch) {
            throw new Error('INVENTORY_SYNC_FAILED');
          }
          continue;
        }

        processedDates.push(date);
      }
    } catch (error) {
      if (processedDates.length && requireMatch) {
        await Promise.all(
          processedDates.map((date) =>
            RoomInventory.updateOne(
              { room: roomId, date },
              {
                $inc: {
                  heldCount: heldDelta * -1,
                  confirmedCount: confirmedDelta * -1,
                },
              }
            )
          )
        );
      }

      throw error;
    }

    await cleanupZeroInventory({ roomId, dates });

    return { source, dates };
  });
};

const releaseRoomHoldForBooking = async (booking) => (
  adjustInventoryCounts({ booking, heldDelta: -1, source: 'hold-release' })
);

const confirmRoomInventoryForBooking = async (booking) => (
  adjustInventoryCounts({
    booking,
    heldDelta: -1,
    confirmedDelta: 1,
    source: 'hold-confirm',
    requireMatch: true,
  })
);

const releaseConfirmedInventoryForBooking = async (booking) => (
  adjustInventoryCounts({ booking, confirmedDelta: -1, source: 'confirmed-release' })
);

const isHoldActive = (booking, reference = new Date()) => (
  booking?.status === 'pending'
  && booking?.payment?.status === 'pending'
  && booking?.holdExpiresAt
  && new Date(booking.holdExpiresAt) > reference
);

const expireSinglePendingBooking = async (booking, reason = 'Booking hold expired before payment completion') => {
  if (!booking || booking.status !== 'pending' || booking.payment?.status !== 'pending') {
    return null;
  }

  await releaseRoomHoldForBooking(booking);

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = reason;
  booking.holdExpiresAt = null;
  booking.payment.status = 'failed';
  await booking.save();

  return booking;
};

const expireStalePendingBookings = async () => {
  const staleBookings = await Booking.find({
    status: 'pending',
    'payment.status': 'pending',
    holdExpiresAt: { $lte: new Date() },
  });

  const expiredBookings = [];
  for (const booking of staleBookings) {
    const expiredBooking = await expireSinglePendingBooking(booking);
    if (expiredBooking) {
      expiredBookings.push(expiredBooking);
    }
  }

  return expiredBookings;
};

module.exports = {
  HOLD_WINDOW_MINUTES,
  getHoldExpiryDate,
  getStayDates,
  acquireRoomHold,
  releaseRoomHoldForBooking,
  confirmRoomInventoryForBooking,
  releaseConfirmedInventoryForBooking,
  isHoldActive,
  expireSinglePendingBooking,
  expireStalePendingBookings,
};
