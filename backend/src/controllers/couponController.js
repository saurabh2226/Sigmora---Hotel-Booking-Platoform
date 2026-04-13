const Coupon = require('../models/Coupon');
const Hotel = require('../models/Hotel');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isAdminRole } = require('../middleware/roles');
const { getApplicableOffers, serializeOffer, isOfferCurrentlyActive } = require('../utils/offerUtils');
const { syncCouponToSql, deactivateCouponInSql } = require('../services/sqlMirrorService');

const getOwnedHotelIds = async (userId) => Hotel.find({ createdBy: userId }).distinct('_id');

const ensureOwnerCanUseHotel = async (user, hotelId) => {
  if (!hotelId) {
    throw new ApiError(400, 'Hotel is required for hotel-owner offers');
  }

  const hotel = await Hotel.findById(hotelId);
  if (!hotel) {
    throw new ApiError(404, 'Hotel not found');
  }

  if (!isAdminRole(user.role) && hotel.createdBy.toString() !== user._id.toString()) {
    throw new ApiError(403, 'You can only attach offers to your own hotels');
  }

  return hotel;
};

const ensureCanManageCoupon = async (user, coupon) => {
  if (isAdminRole(user.role)) {
    return;
  }

  if (!coupon.hotel) {
    throw new ApiError(403, 'Only admins can manage global offers');
  }

  const hotel = await Hotel.findById(coupon.hotel).select('createdBy');
  if (!hotel || hotel.createdBy.toString() !== user._id.toString()) {
    throw new ApiError(403, 'You can only manage offers for your own hotels');
  }
};

// @desc    Get public offers
// @route   GET /api/v1/coupons/offers
const getPublicOffers = asyncHandler(async (req, res) => {
  const hotelId = req.query.hotelId || null;
  const offers = await getApplicableOffers(hotelId ? [hotelId] : []);
  const filteredOffers = hotelId
    ? offers.filter((offer) => !offer.hotel || String(offer.hotel) === String(hotelId))
    : offers.filter((offer) => !offer.hotel);

  res.status(200).json(new ApiResponse(200, {
    offers: filteredOffers.map(serializeOffer),
  }));
});

// @desc    Get manageable offers
// @route   GET /api/v1/coupons/manage
const getManagedCoupons = asyncHandler(async (req, res) => {
  let query = {};

  if (!isAdminRole(req.user.role)) {
    const hotelIds = await getOwnedHotelIds(req.user._id);
    query = { hotel: { $in: hotelIds } };
  }

  const coupons = await Coupon.find(query)
    .populate('hotel', 'title address.city')
    .populate('createdBy', 'name email role')
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  res.status(200).json(new ApiResponse(200, {
    coupons: coupons.map((coupon) => ({
      ...coupon,
      isCurrentlyActive: isOfferCurrentlyActive(coupon),
      preview: serializeOffer(coupon),
    })),
  }));
});

// @desc    Create manageable offer
// @route   POST /api/v1/coupons/manage
const createManagedCoupon = asyncHandler(async (req, res) => {
  const payload = {
    ...req.body,
    createdBy: req.user._id,
  };

  if (!isAdminRole(req.user.role)) {
    await ensureOwnerCanUseHotel(req.user, payload.hotel);
  } else if (payload.hotel) {
    await ensureOwnerCanUseHotel(req.user, payload.hotel);
  }

  const coupon = await Coupon.create(payload);
  await syncCouponToSql(coupon);

  res.status(201).json(new ApiResponse(201, { coupon }, 'Offer created successfully'));
});

// @desc    Update manageable offer
// @route   PUT /api/v1/coupons/manage/:id
const updateManagedCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    throw new ApiError(404, 'Offer not found');
  }

  await ensureCanManageCoupon(req.user, coupon);

  if (!isAdminRole(req.user.role) && Object.prototype.hasOwnProperty.call(req.body, 'hotel') && !req.body.hotel) {
    throw new ApiError(403, 'Hotel owners cannot convert hotel offers into global offers');
  }

  if (req.body.hotel) {
    await ensureOwnerCanUseHotel(req.user, req.body.hotel);
  }

  const updates = { ...req.body };
  delete updates.createdBy;
  delete updates.usedCount;

  Object.assign(coupon, updates);
  await coupon.save();
  await syncCouponToSql(coupon);

  res.status(200).json(new ApiResponse(200, { coupon }, 'Offer updated successfully'));
});

// @desc    Delete manageable offer
// @route   DELETE /api/v1/coupons/manage/:id
const deleteManagedCoupon = asyncHandler(async (req, res) => {
  const coupon = await Coupon.findById(req.params.id);
  if (!coupon) {
    throw new ApiError(404, 'Offer not found');
  }

  await ensureCanManageCoupon(req.user, coupon);
  await coupon.deleteOne();
  await deactivateCouponInSql(coupon._id);

  res.status(200).json(new ApiResponse(200, null, 'Offer deleted successfully'));
});

module.exports = {
  getPublicOffers,
  getManagedCoupons,
  createManagedCoupon,
  updateManagedCoupon,
  deleteManagedCoupon,
};
