const cron = require('node-cron');
const Booking = require('../models/Booking');
const { expireStalePendingBookings } = require('../services/bookingLifecycleService');
const { emitAvailabilityUpdate } = require('../socket/socketHandler');

// Every minute: release expired room holds
cron.schedule('* * * * *', async () => {
  try {
    const expiredBookings = await expireStalePendingBookings();

    if (expiredBookings.length > 0) {
      expiredBookings.forEach((booking) => {
        emitAvailabilityUpdate(booking.hotel, {
          roomId: booking.room,
          action: 'freed',
        });
      });
      console.log(`[Cleanup] Released ${expiredBookings.length} expired booking hold(s)`);
    }
  } catch (error) {
    console.error('[Cleanup] Error releasing expired room holds:', error.message);
  }
});

// Daily at midnight: auto-checkout past bookings
cron.schedule('0 0 * * *', async () => {
  try {
    const now = new Date();

    const result = await Booking.updateMany(
      {
        status: 'checked-in',
        checkOut: { $lt: now },
      },
      {
        status: 'checked-out',
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cleanup] Auto-checked-out ${result.modifiedCount} bookings`);
    }
  } catch (error) {
    console.error('[Cleanup] Error auto-checking-out bookings:', error.message);
  }
});

console.log('✅ Cleanup cron jobs registered');
