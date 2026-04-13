const cron = require('node-cron');
const Booking = require('../models/Booking');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const { sendEmail } = require('../services/emailService');

// Daily at 9 AM: send check-in reminder emails for tomorrow's bookings
cron.schedule('0 9 * * *', async () => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const bookings = await Booking.find({
      status: 'confirmed',
      checkIn: { $gte: tomorrow, $lt: dayAfterTomorrow },
    })
      .populate('user', 'name email')
      .populate('hotel', 'title address policies');

    for (const booking of bookings) {
      if (booking.user?.email) {
        await sendEmail({
          to: booking.user.email,
          subject: `Check-in Reminder - ${booking.hotel.title}`,
          html: `
            <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <h1 style="color: #6366f1;">🏨 Check-in Reminder</h1>
              <p>Hi ${booking.user.name},</p>
              <p>This is a reminder that you have a booking at <strong>${booking.hotel.title}</strong> tomorrow.</p>
              <p><strong>Check-in Time:</strong> ${booking.hotel.policies?.checkInTime || '14:00'}</p>
              <p><strong>Location:</strong> ${booking.hotel.address?.city}, ${booking.hotel.address?.state}</p>
              <p>We hope you have a wonderful stay!</p>
            </div>
          `,
        });
      }
    }

    if (bookings.length > 0) {
      console.log(`[Email] Sent ${bookings.length} check-in reminders`);
    }
  } catch (error) {
    console.error('[Email] Error sending check-in reminders:', error.message);
  }
});

console.log('✅ Email cron jobs registered');
