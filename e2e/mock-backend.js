const http = require('http');

const PORT = 5000;
const HOST = '127.0.0.1';

const hotel = {
  _id: 'hotel_123',
  slug: 'sunrise-palace',
  title: 'Sunrise Palace',
  description: 'A modern city hotel with rooftop views and large family suites.',
  type: 'hotel',
  rating: 4.6,
  totalReviews: 124,
  pricePerNight: 6500,
  maxGuests: 4,
  totalRooms: 32,
  isFeatured: true,
  amenities: ['wifi', 'pool', 'breakfast', 'ac'],
  address: {
    street: '1 Beach Road',
    city: 'Goa',
    state: 'Goa',
    country: 'India',
    zipCode: '403001',
    coordinates: { lat: 15.2993, lng: 74.124 },
  },
  images: [
    { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80' },
  ],
  policies: {
    cancellation: 'moderate',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    petsAllowed: false,
  },
  offers: [
    {
      _id: 'offer_123',
      code: 'GOA20',
      title: 'Goa Escape',
      bannerText: 'Save 20%',
      bannerColor: '#0f766e',
      discountType: 'percentage',
      discountValue: 20,
      minBookingAmount: 5000,
      maxDiscount: 3000,
    },
  ],
};

hotel.primaryOffer = hotel.offers[0];

const room = {
  _id: 'room_123',
  hotel: hotel._id,
  title: 'Premium King Room',
  type: 'suite',
  pricePerNight: 6500,
  maxGuests: 4,
  bedType: 'king',
  roomSize: 420,
  totalRooms: 6,
  amenities: ['wifi', 'ac', 'tv', 'breakfast'],
  images: [{ url: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&q=80' }],
  isActive: true,
};

const availability = [
  {
    roomId: room._id,
    title: room.title,
    type: room.type,
    pricePerNight: room.pricePerNight,
    maxGuests: room.maxGuests,
    bedType: room.bedType,
    roomSize: room.roomSize,
    amenities: room.amenities,
    images: room.images,
    available: true,
    availableCount: 2,
    totalRooms: room.totalRooms,
    dynamicPricing: {
      nights: 2,
      subtotal: 13000,
      taxes: 2340,
      serviceFee: 650,
      discount: 2600,
      totalPrice: 13390,
    },
  },
];

const reviews = [
  {
    _id: 'review_123',
    user: { _id: 'user_123', name: 'Test Traveler' },
    rating: 5,
    title: 'Loved the stay',
    comment: 'Great location, clean rooms, and friendly staff.',
    createdAt: '2026-01-15T12:00:00.000Z',
  },
];

const baseUser = {
  _id: 'user_123',
  name: 'Test Traveler',
  email: 'traveler@example.com',
  phone: '+919876543210',
  role: 'user',
};

const adminUser = {
  _id: 'admin_123',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
};

const sampleBooking = {
  _id: 'book_123',
  hotel: hotel._id,
  room: room._id,
  checkIn: '2026-05-02',
  checkOut: '2026-05-04',
  status: 'confirmed',
  pricing: {
    subtotal: 13000,
    taxes: 2340,
    serviceFee: 650,
    discount: 2600,
    totalPrice: 13390,
  },
};

const sendJson = (req, res, statusCode, payload) => {
  const origin = req.headers.origin || 'http://127.0.0.1:4173';
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(payload));
};

const makeResponse = (data, message = 'ok', success = true) => ({ success, message, data });

const parseBody = (req) => new Promise((resolve) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    if (!raw) {
      resolve({});
      return;
    }

    try {
      resolve(JSON.parse(raw));
    } catch {
      resolve({});
    }
  });
});

const getUserFromBody = (body) => {
  const email = String(body.email || '').toLowerCase();
  return email.includes('admin') ? adminUser : {
    ...baseUser,
    email: body.email || baseUser.email,
    name: body.name || baseUser.name,
    phone: body.phone || baseUser.phone,
  };
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(req, res, 404, makeResponse(null, 'Not found', false));
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': req.headers.origin || 'http://127.0.0.1:4173',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const { pathname } = url;

  if (pathname === '/api/health') {
    sendJson(req, res, 200, {
      success: true,
      message: 'Mock API is running',
      environment: 'test',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  if (pathname === '/api/v1/hotels/featured') {
    sendJson(req, res, 200, makeResponse({ hotels: [hotel] }));
    return;
  }

  if (pathname === '/api/v1/hotels/popular-destinations') {
    sendJson(req, res, 200, makeResponse({
      destinations: [{ city: 'Goa', count: 18, image: hotel.images[0].url }],
    }));
    return;
  }

  if (pathname === '/api/v1/hotels/recommendations') {
    sendJson(req, res, 200, makeResponse({ hotels: [hotel] }));
    return;
  }

  if (pathname === '/api/v1/hotels/search-suggestions') {
    sendJson(req, res, 200, makeResponse({
      suggestions: [{ type: 'hotel', text: hotel.title, slug: hotel.slug, city: hotel.address.city }],
    }));
    return;
  }

  if (pathname === '/api/v1/hotels') {
    sendJson(req, res, 200, makeResponse({
      hotels: [hotel],
      currentPage: 1,
      totalPages: 1,
      totalResults: 1,
    }));
    return;
  }

  if (pathname === `/api/v1/hotels/${hotel._id}/rooms/${room._id}`) {
    sendJson(req, res, 200, makeResponse({ room }));
    return;
  }

  if (pathname === `/api/v1/hotels/${hotel._id}/rooms`) {
    sendJson(req, res, 200, makeResponse({ rooms: [room] }));
    return;
  }

  if (pathname === `/api/v1/hotels/${hotel._id}/availability`) {
    sendJson(req, res, 200, makeResponse({ availability }));
    return;
  }

  if (pathname === `/api/v1/hotels/${hotel._id}` || pathname === `/api/v1/hotels/${hotel.slug}`) {
    sendJson(req, res, 200, makeResponse({ hotel, rooms: [room] }));
    return;
  }

  if (pathname.startsWith('/api/v1/reviews/hotel/')) {
    sendJson(req, res, 200, makeResponse({
      reviews,
      categoryStats: null,
      currentPage: 1,
      totalPages: 1,
      totalResults: reviews.length,
    }));
    return;
  }

  if (pathname === '/api/v1/auth/register' && req.method === 'POST') {
    const body = await parseBody(req);
    sendJson(req, res, 201, makeResponse({
      requiresOtp: true,
      email: body.email || baseUser.email,
      purpose: 'verify-email',
      expiresInSeconds: 600,
    }, 'Account created. Please verify the OTP sent to your email.'));
    return;
  }

  if (pathname === '/api/v1/auth/verify-email-otp' && req.method === 'POST') {
    const body = await parseBody(req);
    const user = getUserFromBody(body);
    sendJson(req, res, 200, makeResponse({
      accessToken: 'register_token_123',
      user,
    }, 'Email verified successfully'));
    return;
  }

  if (pathname === '/api/v1/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const user = getUserFromBody(body);
    sendJson(req, res, 200, makeResponse({
      accessToken: user.role === 'admin' ? 'admin_token_123' : 'token_123',
      user,
    }, 'Login successful'));
    return;
  }

  if (pathname === '/api/v1/auth/me') {
    sendJson(req, res, 200, makeResponse({ user: baseUser }, 'User fetched'));
    return;
  }

  if (pathname === '/api/v1/auth/refresh-token' && req.method === 'POST') {
    sendJson(req, res, 200, makeResponse({ accessToken: 'token_123' }, 'Token refreshed'));
    return;
  }

  if (pathname === '/api/v1/auth/logout' && req.method === 'POST') {
    sendJson(req, res, 200, makeResponse(null, 'Logged out successfully'));
    return;
  }

  if (pathname === '/api/v1/bookings' && req.method === 'POST') {
    sendJson(req, res, 201, makeResponse({ booking: { ...sampleBooking, status: 'pending' } }, 'Booking created'));
    return;
  }

  if (pathname === '/api/v1/bookings/my-bookings') {
    sendJson(req, res, 200, makeResponse({
      bookings: [sampleBooking],
      currentPage: 1,
      totalPages: 1,
      totalResults: 1,
    }));
    return;
  }

  if (pathname === `/api/v1/bookings/${sampleBooking._id}`) {
    sendJson(req, res, 200, makeResponse({ booking: sampleBooking }));
    return;
  }

  if (pathname === '/api/v1/payments/create-order' && req.method === 'POST') {
    sendJson(req, res, 200, makeResponse({
      orderId: 'order_123',
      amount: 1339000,
      currency: 'INR',
      key: 'rzp_test_123',
    }, 'Razorpay order created'));
    return;
  }

  if (pathname === '/api/v1/payments/verify' && req.method === 'POST') {
    sendJson(req, res, 200, makeResponse({
      booking: sampleBooking,
    }, 'Payment verified'));
    return;
  }

  if (pathname === '/api/v1/admin/users') {
    sendJson(req, res, 200, makeResponse({
      users: [
        baseUser,
        adminUser,
      ],
      currentPage: 1,
      totalPages: 1,
      totalResults: 2,
    }));
    return;
  }

  if (/^\/api\/v1\/admin\/users\/[^/]+\/status$/.test(pathname) && req.method === 'PUT') {
    sendJson(req, res, 200, makeResponse({
      user: {
        ...baseUser,
        status: 'inactive',
      },
    }, 'User status updated'));
    return;
  }

  sendJson(req, res, 404, makeResponse(null, `No mock handler for ${req.method} ${pathname}`, false));
});

server.listen(PORT, HOST, () => {
  console.log(`Mock backend listening at http://${HOST}:${PORT}`);
});
