const Coupon = require('../models/Coupon');

const isOfferCurrentlyActive = (offer) => {
  if (!offer || !offer.isActive) return false;

  const now = new Date();
  const usageLimit = Number.isFinite(offer.usageLimit) ? offer.usageLimit : Infinity;

  return (
    offer.usedCount < usageLimit &&
    (!offer.validFrom || now >= new Date(offer.validFrom)) &&
    (!offer.validUntil || now <= new Date(offer.validUntil))
  );
};

const serializeOffer = (offer) => ({
  _id: offer._id,
  title: offer.title,
  description: offer.description,
  code: offer.code,
  bannerText: offer.bannerText,
  bannerColor: offer.bannerColor,
  discountType: offer.discountType,
  discountValue: offer.discountValue,
  minBookingAmount: offer.minBookingAmount,
  maxDiscount: offer.maxDiscount,
  validFrom: offer.validFrom,
  validUntil: offer.validUntil,
  hotel: offer.hotel || null,
  scope: offer.scope,
  priority: offer.priority || 0,
});

const getApplicableOffers = async (hotelIds = []) => {
  const ids = hotelIds.filter(Boolean);
  const query = ids.length > 0
    ? { $or: [{ hotel: { $in: ids } }, { hotel: null }] }
    : { hotel: null };

  const offers = await Coupon.find({
    isActive: true,
    ...query,
  })
    .sort({ priority: -1, createdAt: -1 })
    .lean();

  return offers.filter(isOfferCurrentlyActive);
};

const attachOffersToHotels = async (hotels) => {
  if (!Array.isArray(hotels) || hotels.length === 0) {
    return hotels || [];
  }

  const normalizedHotels = hotels.map((hotel) => (hotel?.toObject ? hotel.toObject() : { ...hotel }));
  const hotelIds = normalizedHotels.map((hotel) => hotel._id);
  const offers = await getApplicableOffers(hotelIds);

  const globalOffers = offers.filter((offer) => !offer.hotel).map(serializeOffer);
  const hotelOffersMap = new Map();

  offers
    .filter((offer) => offer.hotel)
    .forEach((offer) => {
      const key = String(offer.hotel);
      const current = hotelOffersMap.get(key) || [];
      current.push(serializeOffer(offer));
      hotelOffersMap.set(key, current);
    });

  return normalizedHotels.map((hotel) => {
    const hotelOffers = hotelOffersMap.get(String(hotel._id)) || [];
    const offersForHotel = [...hotelOffers, ...globalOffers].slice(0, 4);

    return {
      ...hotel,
      offers: offersForHotel,
      primaryOffer: offersForHotel[0] || null,
    };
  });
};

module.exports = {
  isOfferCurrentlyActive,
  serializeOffer,
  getApplicableOffers,
  attachOffersToHotels,
};
