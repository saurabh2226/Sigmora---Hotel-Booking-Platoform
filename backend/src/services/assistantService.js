const Hotel = require('../models/Hotel');
const { attachOffersToHotels } = require('../utils/offerUtils');
const { getRecommendations } = require('./recommendationService');

const KNOWN_AMENITIES = [
  'wifi',
  'parking',
  'pool',
  'gym',
  'spa',
  'restaurant',
  'bar',
  'room-service',
  'laundry',
  'ac',
  'tv',
  'breakfast',
  'pet-friendly',
  'ev-charging',
  'business-center',
  'concierge',
];

const formatCurrency = (value = 0) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const parsePriceLimit = (message) => {
  const match = message.match(/(?:under|below|within|budget|less than|max(?:imum)?)\s*₹?\s*(\d{2,6})/i);
  return match ? Number(match[1]) : null;
};

const parseRatingFloor = (message) => {
  const match = message.match(/(\d(?:\.\d)?)\s*(?:star|rating|\+)/i);
  return match ? Number(match[1]) : null;
};

const pickDetectedCity = (message, cities = []) => {
  const normalizedMessage = message.toLowerCase();
  return cities.find((city) => normalizedMessage.includes(city.toLowerCase())) || '';
};

const pickAmenities = (message) => {
  const normalizedMessage = message.toLowerCase();
  return KNOWN_AMENITIES.filter((amenity) => normalizedMessage.includes(amenity.toLowerCase()));
};

const summarizeHotel = (hotel) => {
  const offerCopy = hotel.primaryOffer
    ? ` Offer: ${hotel.primaryOffer.code} (${hotel.primaryOffer.bannerText || hotel.primaryOffer.title}).`
    : '';

  return `${hotel.title} in ${hotel.address?.city}, ${hotel.address?.state} from ${formatCurrency(hotel.pricePerNight)}/night, rated ${hotel.rating?.toFixed?.(1) || hotel.rating || '4.0'}.${offerCopy}`;
};

const getAssistantResponse = async ({ message, userId }) => {
  const trimmedMessage = String(message || '').trim();
  if (!trimmedMessage) {
    return {
      reply: 'Ask me about destinations, budgets, hotel types, amenities, offers, or personalized stay suggestions and I’ll pull the best matching stays from Sigmora.',
      hotels: [],
    };
  }

  const activeCities = await Hotel.distinct('address.city', { isActive: true });
  const detectedCity = pickDetectedCity(trimmedMessage, activeCities);
  const maxPrice = parsePriceLimit(trimmedMessage);
  const ratingFloor = parseRatingFloor(trimmedMessage);
  const amenities = pickAmenities(trimmedMessage);
  const wantsOffers = /offer|coupon|discount|deal|save/i.test(trimmedMessage);
  const wantsRecommendations = /recommend|suggest|best for me|personal/i.test(trimmedMessage);

  if (wantsRecommendations && userId) {
    const recommendedHotels = await attachOffersToHotels(await getRecommendations(userId, 4));
    if (recommendedHotels.length > 0) {
      return {
        reply: `Here are personalized picks based on your Sigmora history: ${recommendedHotels.map(summarizeHotel).join(' ')}`,
        hotels: recommendedHotels,
      };
    }
  }

  const query = { isActive: true };
  if (detectedCity) {
    query['address.city'] = detectedCity;
  }
  if (maxPrice) {
    query.pricePerNight = { $lte: maxPrice };
  }
  if (ratingFloor) {
    query.rating = { $gte: ratingFloor };
  }
  if (amenities.length > 0) {
    query.amenities = { $all: amenities };
  }

  const hotels = await attachOffersToHotels(
    await Hotel.find(query)
      .sort(wantsOffers ? { rating: -1, createdAt: -1 } : { rating: -1, totalReviews: -1 })
      .limit(4)
      .lean()
  );

  if (hotels.length === 0) {
    return {
      reply: 'I could not find an exact match from the current Sigmora inventory. Try mentioning a city, a budget like “under 5000”, or amenities such as wifi, pool, or breakfast.',
      hotels: [],
    };
  }

  const contextBits = [];
  if (detectedCity) contextBits.push(`in ${detectedCity}`);
  if (maxPrice) contextBits.push(`within ${formatCurrency(maxPrice)}`);
  if (ratingFloor) contextBits.push(`rated ${ratingFloor}+`);
  if (amenities.length > 0) contextBits.push(`with ${amenities.join(', ')}`);

  const intro = wantsOffers
    ? `I found ${hotels.length} offer-friendly stays${contextBits.length ? ` ${contextBits.join(' ')}` : ''}.`
    : `Here are ${hotels.length} strong matches${contextBits.length ? ` ${contextBits.join(' ')}` : ''}.`;

  return {
    reply: `${intro} ${hotels.map(summarizeHotel).join(' ')}`,
    hotels,
  };
};

module.exports = {
  getAssistantResponse,
};
