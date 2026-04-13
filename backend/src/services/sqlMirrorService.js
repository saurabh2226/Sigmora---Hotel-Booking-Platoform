const MongoUser = require('../models/User');
const MongoHotel = require('../models/Hotel');
const MongoRoom = require('../models/Room');
const MongoBooking = require('../models/Booking');
const MongoReview = require('../models/Review');
const MongoCoupon = require('../models/Coupon');
const MongoPayment = require('../models/Payment');
const MongoNotification = require('../models/Notification');
const {
  User: SqlUser,
  Hotel: SqlHotel,
  Room: SqlRoom,
  Booking: SqlBooking,
  Review: SqlReview,
  Coupon: SqlCoupon,
  Payment: SqlPayment,
  Notification: SqlNotification,
} = require('../models/sql');

const toMongoId = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
};

const toPlain = (doc) => {
  if (!doc) return null;
  return typeof doc.toObject === 'function'
    ? doc.toObject({ depopulate: false })
    : doc;
};

const cleanPayload = (payload) => Object.fromEntries(
  Object.entries(payload).filter(([, value]) => value !== undefined)
);

const roundMoney = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  return Math.round(Number(value) * 100) / 100;
};

const buildUserStatus = (user) => {
  if (user.isActive === false) {
    return 'inactive';
  }

  return user.status || 'active';
};

const buildHotelStatus = (hotel) => {
  if (hotel.isActive === false) {
    return 'inactive';
  }

  return hotel.status || 'active';
};

const findExistingMirror = async (Model, mongoId, fallbackWhere) => {
  if (mongoId) {
    const byMongoId = await Model.findOne({ where: { mongoId } });
    if (byMongoId) {
      return byMongoId;
    }
  }

  if (!fallbackWhere) {
    return null;
  }

  const existing = await Model.findOne({ where: fallbackWhere });
  if (existing && mongoId && !existing.mongoId) {
    await existing.update({ mongoId });
  }

  return existing;
};

const upsertMirror = async (Model, mongoId, payload, fallbackWhere) => {
  const existing = await findExistingMirror(Model, mongoId, fallbackWhere);
  const finalPayload = cleanPayload({
    ...(mongoId ? { mongoId } : {}),
    ...payload,
  });

  if (existing) {
    await existing.update(finalPayload);
    return existing;
  }

  return Model.create(finalPayload);
};

const ensureSqlUser = async (userLike) => {
  const mongoId = toMongoId(userLike);
  if (!mongoId) return null;

  const existing = await SqlUser.findOne({ where: { mongoId } });
  if (existing) return existing;

  const mongoUser = userLike?.email
    ? userLike
    : await MongoUser.findById(mongoId).select('+password');

  if (!mongoUser) return null;
  return syncUserToSql(mongoUser);
};

const ensureSqlHotel = async (hotelLike) => {
  const mongoId = toMongoId(hotelLike);
  if (!mongoId) return null;

  const existing = await SqlHotel.findOne({ where: { mongoId } });
  if (existing) return existing;

  const mongoHotel = hotelLike?.title
    ? hotelLike
    : await MongoHotel.findById(mongoId).lean();

  if (!mongoHotel) return null;
  return syncHotelToSql(mongoHotel);
};

const ensureSqlRoom = async (roomLike) => {
  const mongoId = toMongoId(roomLike);
  if (!mongoId) return null;

  const existing = await SqlRoom.findOne({ where: { mongoId } });
  if (existing) return existing;

  const mongoRoom = roomLike?.title
    ? roomLike
    : await MongoRoom.findById(mongoId).lean();

  if (!mongoRoom) return null;
  return syncRoomToSql(mongoRoom);
};

const ensureSqlBooking = async (bookingLike) => {
  const mongoId = toMongoId(bookingLike);
  if (!mongoId) return null;

  const existing = await SqlBooking.findOne({ where: { mongoId } });
  if (existing) return existing;

  const mongoBooking = bookingLike?.checkIn
    ? bookingLike
    : await MongoBooking.findById(mongoId).lean();

  if (!mongoBooking) return null;
  return syncBookingToSql(mongoBooking);
};

const ensureSqlCoupon = async (couponLike) => {
  const mongoId = toMongoId(couponLike);
  if (!mongoId) return null;

  const existing = await SqlCoupon.findOne({ where: { mongoId } });
  if (existing) return existing;

  const mongoCoupon = couponLike?.code
    ? couponLike
    : await MongoCoupon.findById(mongoId).lean();

  if (!mongoCoupon) return null;
  return syncCouponToSql(mongoCoupon);
};

const syncUserToSql = async (userDoc) => {
  const user = toPlain(userDoc);
  if (!user?._id) return null;

  return upsertMirror(SqlUser, String(user._id), {
    name: user.name,
    email: user.email,
    password: user.password,
    phone: user.phone || '',
    avatar: user.avatar || '',
    role: user.role || 'user',
    status: buildUserStatus(user),
    isVerified: user.isVerified ?? false,
    provider: user.provider || 'local',
    googleId: user.googleId || null,
    currency: user.preferences?.currency || user.currency || 'INR',
    notificationsEnabled: user.preferences?.notifications ?? true,
    theme: user.preferences?.theme || user.theme || 'light',
    lastLogin: user.lastLogin || null,
  }, { email: user.email });
};

const syncHotelToSql = async (hotelDoc) => {
  const hotel = toPlain(hotelDoc);
  if (!hotel?._id) return null;

  const ownerMongoId = toMongoId(hotel.createdBy);
  const owner = await ensureSqlUser(hotel.createdBy);

  return upsertMirror(SqlHotel, String(hotel._id), {
    createdById: owner?.id,
    createdByMongoId: ownerMongoId,
    title: hotel.title,
    slug: hotel.slug,
    description: hotel.description,
    type: hotel.type,
    pricePerNight: roundMoney(hotel.pricePerNight),
    street: hotel.address?.street,
    city: hotel.address?.city,
    state: hotel.address?.state,
    zipCode: hotel.address?.zipCode,
    country: hotel.address?.country || 'India',
    latitude: hotel.address?.coordinates?.lat,
    longitude: hotel.address?.coordinates?.lng,
    maxGuests: hotel.maxGuests,
    totalRooms: hotel.totalRooms,
    rating: hotel.rating || 0,
    totalReviews: hotel.totalReviews || 0,
    isFeatured: hotel.isFeatured || false,
    status: buildHotelStatus(hotel),
    amenities: hotel.amenities || [],
    images: hotel.images || [],
    policies: hotel.policies || {},
    contact: hotel.contact || {},
  }, hotel.slug ? { slug: hotel.slug } : undefined);
};

const syncRoomToSql = async (roomDoc) => {
  const room = toPlain(roomDoc);
  if (!room?._id) return null;

  const hotelMongoId = toMongoId(room.hotel);
  const hotel = await ensureSqlHotel(room.hotel);

  return upsertMirror(SqlRoom, String(room._id), {
    hotelId: hotel?.id,
    hotelMongoId,
    hotelTitle: hotel?.title,
    title: room.title,
    type: room.type,
    pricePerNight: roundMoney(room.pricePerNight),
    maxGuests: room.maxGuests,
    totalRooms: room.totalRooms,
    bedType: room.bedType,
    size: room.roomSize ?? room.size,
    amenities: room.amenities || [],
    images: room.images || [],
    isActive: room.isActive !== false,
  });
};

const syncCouponToSql = async (couponDoc) => {
  const coupon = toPlain(couponDoc);
  if (!coupon?._id) return null;

  const hotelMongoId = toMongoId(coupon.hotel);
  const createdByMongoId = toMongoId(coupon.createdBy);
  const hotel = await ensureSqlHotel(coupon.hotel);
  const createdBy = await ensureSqlUser(coupon.createdBy);

  return upsertMirror(SqlCoupon, String(coupon._id), {
    hotelId: hotel?.id,
    createdById: createdBy?.id,
    hotelMongoId,
    createdByMongoId,
    title: coupon.title || '',
    description: coupon.description || '',
    code: coupon.code,
    discountType: coupon.discountType,
    discountValue: roundMoney(coupon.discountValue),
    minBookingAmount: roundMoney(coupon.minBookingAmount) || 0,
    maxDiscount: roundMoney(coupon.maxDiscount),
    bannerText: coupon.bannerText || '',
    bannerColor: coupon.bannerColor || '#0f766e',
    scope: coupon.scope || (coupon.hotel ? 'hotel' : 'global'),
    priority: coupon.priority || 0,
    validFrom: coupon.validFrom || null,
    validUntil: coupon.validUntil || null,
    usageLimit: coupon.usageLimit || 100,
    usedCount: coupon.usedCount || 0,
    isActive: coupon.isActive !== false,
  }, { code: coupon.code });
};

const syncBookingToSql = async (bookingDoc) => {
  const booking = toPlain(bookingDoc);
  if (!booking?._id) return null;

  const mongoUser = booking.user && booking.user.email
    ? booking.user
    : await MongoUser.findById(toMongoId(booking.user)).select('+password').lean();
  const mongoHotel = booking.hotel && booking.hotel.title
    ? booking.hotel
    : await MongoHotel.findById(toMongoId(booking.hotel)).lean();
  const mongoRoom = booking.room && booking.room.title
    ? booking.room
    : await MongoRoom.findById(toMongoId(booking.room)).lean();

  const sqlUser = await ensureSqlUser(mongoUser || booking.user);
  const sqlHotel = await ensureSqlHotel(mongoHotel || booking.hotel);
  const sqlRoom = await ensureSqlRoom(mongoRoom || booking.room);

  return upsertMirror(SqlBooking, String(booking._id), {
    userId: sqlUser?.id,
    hotelId: sqlHotel?.id,
    roomId: sqlRoom?.id,
    userMongoId: toMongoId(booking.user),
    hotelMongoId: toMongoId(booking.hotel),
    roomMongoId: toMongoId(booking.room),
    ownerMongoId: toMongoId(mongoHotel?.createdBy),
    userName: booking.guestDetails?.name || mongoUser?.name || booking.userName,
    userEmail: booking.guestDetails?.email || mongoUser?.email || booking.userEmail,
    hotelTitle: mongoHotel?.title || booking.hotelTitle,
    hotelCity: mongoHotel?.address?.city || booking.hotelCity,
    roomTitle: mongoRoom?.title || booking.roomTitle,
    roomType: mongoRoom?.type || booking.roomType,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: booking.guests?.adults ?? booking.adults ?? 1,
    children: booking.guests?.children ?? booking.children ?? 0,
    guestName: booking.guestDetails?.name,
    guestEmail: booking.guestDetails?.email,
    guestPhone: booking.guestDetails?.phone,
    status: booking.status || 'pending',
    amount: roundMoney(booking.pricing?.subtotal ?? booking.amount ?? booking.totalAmount ?? 0),
    taxes: roundMoney(booking.pricing?.taxes ?? booking.taxes),
    serviceFee: roundMoney(booking.pricing?.serviceFee),
    discount: roundMoney(booking.pricing?.discount),
    totalAmount: roundMoney(booking.pricing?.totalPrice ?? booking.totalAmount ?? booking.amount ?? 0),
    numberOfNights: booking.pricing?.numberOfNights,
    couponCode: booking.pricing?.couponCode || booking.couponCode || null,
    holdExpiresAt: booking.holdExpiresAt || null,
    razorpayPaymentId: booking.payment?.status === 'completed' ? booking.payment?.transactionId : booking.razorpayPaymentId,
    razorpayOrderId: booking.payment?.status === 'pending' ? booking.payment?.transactionId : booking.razorpayOrderId,
    paymentStatus: booking.payment?.status || booking.paymentStatus || 'pending',
    paymentMethod: booking.payment?.method || booking.paymentMethod || null,
    specialRequests: booking.guestDetails?.specialRequests || booking.specialRequests || null,
    cancellationReason: booking.cancellationReason || null,
    refundAmount: roundMoney(booking.refundAmount) || 0,
  });
};

const syncReviewToSql = async (reviewDoc) => {
  const review = toPlain(reviewDoc);
  if (!review?._id) return null;

  const sqlUser = await ensureSqlUser(review.user);
  const sqlHotel = await ensureSqlHotel(review.hotel);
  const sqlBooking = await ensureSqlBooking(review.booking);

  return upsertMirror(SqlReview, String(review._id), {
    userId: sqlUser?.id,
    hotelId: sqlHotel?.id,
    bookingId: sqlBooking?.id,
    userMongoId: toMongoId(review.user),
    hotelMongoId: toMongoId(review.hotel),
    bookingMongoId: toMongoId(review.booking),
    rating: review.rating,
    title: review.title || null,
    comment: review.comment,
    categories: review.categories || {},
    helpfulVotes: review.helpfulCount ?? review.helpfulVotes ?? 0,
    images: review.images || [],
    adminResponse: review.response?.text || review.adminResponse || null,
    adminResponseAt: review.response?.respondedAt || review.adminResponseAt || null,
    isVerified: review.isVerified !== false,
    isDeleted: false,
  });
};

const syncPaymentToSql = async (paymentDoc) => {
  const payment = toPlain(paymentDoc);
  if (!payment?._id) return null;

  const sqlBooking = await ensureSqlBooking(payment.booking);
  const sqlUser = await ensureSqlUser(payment.user);

  return upsertMirror(SqlPayment, String(payment._id), {
    bookingId: sqlBooking?.id,
    userId: sqlUser?.id,
    bookingMongoId: toMongoId(payment.booking),
    userMongoId: toMongoId(payment.user),
    amount: roundMoney(payment.amount) || 0,
    currency: payment.currency || 'INR',
    method: payment.method || 'razorpay',
    transactionId: payment.transactionId,
    status: payment.status || 'pending',
    gatewayResponse: payment.gatewayResponse || {},
    refundId: payment.refundId || null,
    refundedAt: payment.refundedAt || null,
  }, payment.transactionId ? { transactionId: payment.transactionId } : undefined);
};

const syncNotificationToSql = async (notificationDoc) => {
  const notification = toPlain(notificationDoc);
  if (!notification?._id) return null;

  const sqlUser = await ensureSqlUser(notification.user);

  return upsertMirror(SqlNotification, String(notification._id), {
    userId: sqlUser?.id,
    userMongoId: toMongoId(notification.user),
    type: notification.type,
    title: notification.title,
    message: notification.message,
    isRead: notification.isRead ?? false,
    link: notification.link || null,
    metadata: notification.metadata || {},
  });
};

const syncNotificationsForUserToSql = async (userId) => {
  const notifications = await MongoNotification.find({ user: userId }).lean();
  const synced = [];

  for (const notification of notifications) {
    synced.push(await syncNotificationToSql(notification));
  }

  return synced;
};

const markReviewDeletedInSql = async (reviewId) => {
  const mongoId = toMongoId(reviewId);
  if (!mongoId) return null;

  const row = await SqlReview.findOne({ where: { mongoId } });
  if (!row) return null;

  await row.update({ isDeleted: true });
  return row;
};

const deactivateCouponInSql = async (couponId) => {
  const mongoId = toMongoId(couponId);
  if (!mongoId) return null;

  const row = await SqlCoupon.findOne({ where: { mongoId } });
  if (!row) return null;

  await row.update({ isActive: false });
  return row;
};

const syncAllMongoDataToSql = async () => {
  const users = await MongoUser.find().select('+password').lean();
  for (const user of users) {
    await syncUserToSql(user);
  }

  const hotels = await MongoHotel.find().lean();
  for (const hotel of hotels) {
    await syncHotelToSql(hotel);
  }

  const rooms = await MongoRoom.find().lean();
  for (const room of rooms) {
    await syncRoomToSql(room);
  }

  const coupons = await MongoCoupon.find().lean();
  for (const coupon of coupons) {
    await syncCouponToSql(coupon);
  }

  const bookings = await MongoBooking.find().lean();
  for (const booking of bookings) {
    await syncBookingToSql(booking);
  }

  const reviews = await MongoReview.find().lean();
  for (const review of reviews) {
    await syncReviewToSql(review);
  }

  const payments = await MongoPayment.find().lean();
  for (const payment of payments) {
    await syncPaymentToSql(payment);
  }

  const notifications = await MongoNotification.find().lean();
  for (const notification of notifications) {
    await syncNotificationToSql(notification);
  }

  return {
    users: users.length,
    hotels: hotels.length,
    rooms: rooms.length,
    coupons: coupons.length,
    bookings: bookings.length,
    reviews: reviews.length,
    payments: payments.length,
    notifications: notifications.length,
  };
};

module.exports = {
  syncUserToSql,
  syncHotelToSql,
  syncRoomToSql,
  syncCouponToSql,
  syncBookingToSql,
  syncReviewToSql,
  syncPaymentToSql,
  syncNotificationToSql,
  syncNotificationsForUserToSql,
  markReviewDeletedInSql,
  deactivateCouponInSql,
  syncAllMongoDataToSql,
};
