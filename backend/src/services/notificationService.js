const Notification = require('../models/Notification');
const User = require('../models/User');
const { emitToUser, emitToAdmins } = require('../socket/socketHandler');
const { syncNotificationToSql } = require('./sqlMirrorService');

/**
 * Create and push a notification to a user
 */
const createNotification = async ({ userId, type, title, message, link, metadata }) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      link,
      metadata,
    });

    try {
      await syncNotificationToSql(notification);
    } catch (error) {
      console.error('Notification SQL sync error:', error.message);
    }

    // Push real-time notification via Socket.IO
    emitToUser(String(userId), 'notification:new', {
      _id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (error) {
    console.error('Create notification error:', error.message);
    return null;
  }
};

/**
 * Notify admins of a new booking
 */
const notifyNewBooking = async (booking, user, hotel) => {
  // Notify admins
  emitToAdmins('booking:new', {
    bookingId: booking._id,
    userName: user.name,
    hotelName: hotel.title,
    totalPrice: booking.pricing.totalPrice,
    checkIn: booking.checkIn,
  });

  const admins = await User.find({
    role: { $in: ['admin', 'owner', 'superadmin'] },
    isActive: true,
  })
    .select('_id')
    .lean();

  await Promise.all(admins.map((adminUser) => (
    createNotification({
      userId: adminUser._id,
      type: 'booking',
      title: 'New booking received',
      message: `${user.name} booked ${hotel.title}.`,
      link: '/admin/bookings',
      metadata: { bookingId: booking._id, hotelId: hotel._id, userId: user._id },
    })
  )));

  // Create notification for user
  await createNotification({
    userId: user._id,
    type: 'booking',
    title: 'Booking Created',
    message: `Your booking at ${hotel.title} has been created successfully.`,
    link: `/booking/confirmation/${booking._id}`,
    metadata: { bookingId: booking._id },
  });
};

/**
 * Notify user of booking status update
 */
const notifyBookingStatusUpdate = async (booking, hotel, newStatus) => {
  const statusMessages = {
    confirmed: `Your booking at ${hotel.title} has been confirmed!`,
    'checked-in': `Welcome! You've checked in at ${hotel.title}.`,
    'checked-out': `Thank you for staying at ${hotel.title}. We hope you enjoyed your stay!`,
    cancelled: `Your booking at ${hotel.title} has been cancelled.`,
    'no-show': `Your booking at ${hotel.title} has been marked as no-show.`,
  };

  await createNotification({
    userId: booking.user,
    type: 'booking',
    title: `Booking ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
    message: statusMessages[newStatus] || `Booking status updated to ${newStatus}`,
    link: '/dashboard',
    metadata: { bookingId: booking._id, status: newStatus },
  });

  // Push Socket.IO event
  emitToUser(booking.user.toString(), 'booking:status-update', {
    bookingId: booking._id,
    status: newStatus,
  });
};

module.exports = {
  createNotification,
  notifyNewBooking,
  notifyBookingStatusUpdate,
};
