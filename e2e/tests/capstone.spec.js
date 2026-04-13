// @ts-check
const { test, expect } = require('@playwright/test');

const makeApiResponse = (data, message = 'ok', success = true) => ({
  success,
  message,
  data,
});

const user = {
  _id: 'user_123',
  name: 'Test Traveler',
  email: 'traveler@example.com',
  phone: '+919876543210',
  role: 'user',
};

const admin = {
  _id: 'admin_123',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin',
};

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
    city: 'Goa',
    state: 'Goa',
    country: 'India',
    coordinates: { lat: 15.2993, lng: 74.124 },
  },
  images: [{ url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80' }],
  policies: {
    cancellation: 'moderate',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    petsAllowed: false,
  },
};

const room = {
  _id: 'room_123',
  hotel: 'hotel_123',
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

const availability = [{
  roomId: 'room_123',
  title: 'Premium King Room',
  type: 'suite',
  pricePerNight: 6500,
  maxGuests: 4,
  bedType: 'king',
  roomSize: 420,
  amenities: ['wifi', 'ac', 'tv', 'breakfast'],
  images: room.images,
  available: true,
  availableCount: 2,
  totalRooms: 6,
}];

const mockCommonPublicData = async (page) => {
  await page.route('**/api/v1/hotels/featured', (route) => route.fulfill({ json: makeApiResponse({ hotels: [hotel] }) }));
  await page.route('**/api/v1/hotels/popular-destinations', (route) => route.fulfill({
    json: makeApiResponse({
      destinations: [{ city: 'Goa', count: 18, image: hotel.images[0].url }],
    }),
  }));
  await page.route('**/api/v1/hotels/recommendations', (route) => route.fulfill({ json: makeApiResponse({ hotels: [hotel] }) }));
};

test.describe('Capstone UI Flows', () => {
  test('login flow works end to end with mocked auth API', async ({ page }) => {
    await mockCommonPublicData(page);
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({
      json: makeApiResponse({
        accessToken: 'token_123',
        user,
      }, 'Login successful'),
    }));

    await page.goto('/login');
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/$/);
    const storedToken = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(storedToken).toBe('token_123');
  });

  test('hotel listing, search, and details render from mocked hotel APIs', async ({ page }) => {
    await page.route('**/api/v1/hotels?**', (route) => route.fulfill({
      json: makeApiResponse({
        hotels: [hotel],
        currentPage: 1,
        totalPages: 1,
        totalResults: 1,
      }),
    }));
    await page.route(`**/api/v1/hotels/${hotel.slug}`, (route) => route.fulfill({
      json: makeApiResponse({
        hotel,
        rooms: [room],
      }),
    }));
    await page.route('**/api/v1/reviews/hotel/**', (route) => route.fulfill({
      json: makeApiResponse({
        reviews: [],
        categoryStats: null,
        currentPage: 1,
        totalPages: 1,
        totalResults: 0,
      }),
    }));
    await page.route('**/api/v1/hotels/**/availability**', (route) => route.fulfill({ json: makeApiResponse({ availability }) }));

    await page.goto('/hotels?city=Goa');
    await expect(page.locator('h1')).toContainText('Hotels');
    await expect(page.locator(`a[href="/hotels/${hotel.slug}"]`)).toBeVisible();
    await page.fill('input[placeholder="Hotel name..."]', 'Sunrise');
    await page.click(`a[href="/hotels/${hotel.slug}"]`);

    await expect(page).toHaveURL(new RegExp(`/hotels/${hotel.slug}$`));
    await expect(page.locator('h1')).toContainText(hotel.title);
    await expect(page.locator('text=Location & Map')).toBeVisible();
    await expect(page.locator('text=Premium King Room')).toBeVisible();
  });

  test('booking flow completes through mocked Razorpay checkout', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('accessToken', 'user_token_123');
      localStorage.setItem('user', JSON.stringify(payload.user));
      window.Razorpay = function Razorpay(options) {
        this.on = () => {};
        this.open = () => {
          options.handler({
            razorpay_payment_id: 'pay_test_123',
            razorpay_signature: 'signature_123',
          });
        };
      };
    }, { user });

    await page.route(`**/api/v1/hotels/${hotel._id}`, (route) => route.fulfill({
      json: makeApiResponse({
        hotel,
        rooms: [room],
      }),
    }));
    await page.route(`**/api/v1/hotels/${hotel._id}/rooms/${room._id}`, (route) => route.fulfill({
      json: makeApiResponse({ room }),
    }));
    await page.route(`**/api/v1/hotels/${hotel._id}/availability**`, (route) => route.fulfill({
      json: makeApiResponse({ availability }),
    }));
    await page.route('**/api/v1/bookings', (route) => {
      if (route.request().method() !== 'POST') {
        route.continue();
        return;
      }
      route.fulfill({
        json: makeApiResponse({
          booking: {
            _id: 'book_123',
            hotel: hotel._id,
            room: room._id,
            checkIn: '2026-05-02',
            checkOut: '2026-05-04',
            pricing: { totalPrice: 16055 },
            status: 'pending',
          },
        }, 'Booking created'),
      });
    });
    await page.route('**/api/v1/payments/create-order', (route) => route.fulfill({
      json: makeApiResponse({
        orderId: 'order_123',
        amount: 1605500,
        currency: 'INR',
        key: 'rzp_test_123',
      }, 'Razorpay order created'),
    }));
    await page.route('**/api/v1/payments/verify', (route) => route.fulfill({
      json: makeApiResponse({
        booking: {
          _id: 'book_123',
          status: 'confirmed',
          pricing: { totalPrice: 16055 },
        },
      }, 'Payment verified'),
    }));
    await page.route('**/api/v1/bookings/book_123', (route) => route.fulfill({
      json: makeApiResponse({
        booking: {
          _id: 'book_123',
          status: 'confirmed',
          checkIn: '2026-05-02',
          checkOut: '2026-05-04',
          pricing: { totalPrice: 16055 },
        },
      }),
    }));

    await page.goto(`/booking/${hotel._id}/${room._id}`);
    await expect(page.locator('text=Booking Summary')).toBeVisible();
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/booking\/confirmation\/book_123/);
    await expect(page.locator('h1')).toContainText('Booking Confirmed');
  });

  test('admin users screen loads and can toggle account status with mocked admin APIs', async ({ page }) => {
    await page.addInitScript((payload) => {
      localStorage.setItem('accessToken', 'admin_token_123');
      localStorage.setItem('user', JSON.stringify(payload.user));
    }, { user: admin });

    await page.route('**/api/v1/admin/users?**', (route) => route.fulfill({
      json: makeApiResponse({
        users: [
          {
            _id: 'managed_user_1',
            name: 'Managed User',
            email: 'managed@example.com',
            role: 'user',
            provider: 'local',
            isActive: true,
            createdAt: '2026-01-10T10:00:00.000Z',
          },
        ],
        currentPage: 1,
        totalPages: 1,
        totalResults: 1,
      }),
    }));
    await page.route('**/api/v1/admin/users/managed_user_1/status', (route) => route.fulfill({
      json: makeApiResponse({
        user: {
          _id: 'managed_user_1',
          isActive: false,
        },
      }, 'User deactivated'),
    }));

    await page.goto('/admin/users');
    await expect(page.locator('h1')).toContainText('Manage Users');
    await expect(page.locator('text=Managed User')).toBeVisible();
    await page.click('button:has-text("Deactivate")');
    await expect(page.locator('span').filter({ hasText: /^inactive$/i })).toBeVisible();
  });
});
