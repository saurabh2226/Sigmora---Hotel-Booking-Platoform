// @ts-check
const { test, expect } = require('@playwright/test');

const makeApiResponse = (data, message = 'ok', success = true) => ({
  success,
  message,
  data,
});

const mockHomeData = async (page) => {
  await page.route('**/api/v1/hotels/featured', (route) => route.fulfill({
    json: makeApiResponse({
      hotels: [{
        _id: 'hotel_home_1',
        slug: 'harbor-suites',
        title: 'Harbor Suites',
        rating: 4.8,
        totalReviews: 120,
        pricePerNight: 4200,
        amenities: ['wifi', 'pool'],
        images: [],
        address: { city: 'Goa', state: 'Goa' },
      }],
    }),
  }));

  await page.route('**/api/v1/hotels/popular-destinations', (route) => route.fulfill({
    json: makeApiResponse({
      destinations: [{ city: 'Goa', count: 12, image: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=400&q=80' }],
    }),
  }));

  await page.route('**/api/v1/hotels/recommendations', (route) => route.fulfill({
    json: makeApiResponse({
      hotels: [{
        _id: 'hotel_rec_1',
        slug: 'sunrise-palace',
        title: 'Sunrise Palace',
        rating: 4.7,
        totalReviews: 88,
        pricePerNight: 6500,
        amenities: ['wifi', 'breakfast'],
        images: [],
        address: { city: 'Delhi', state: 'Delhi' },
      }],
    }),
  }));
};

test.describe('Authentication Flow', () => {
  test('registers a new user and verifies OTP end to end', async ({ page }) => {
    await mockHomeData(page);

    await page.route('**/api/v1/auth/register', (route) => route.fulfill({
      json: makeApiResponse({
        requiresOtp: true,
        email: 'traveler@example.com',
        purpose: 'verify-email',
        expiresInSeconds: 600,
      }, 'Account created. Please verify the OTP sent to your email.'),
    }));

    await page.route('**/api/v1/auth/verify-email-otp', (route) => route.fulfill({
      json: makeApiResponse({
        accessToken: 'register_token_123',
        user: {
          _id: 'user_123',
          name: 'Test Traveler',
          email: 'traveler@example.com',
          role: 'user',
        },
      }, 'Email verified successfully'),
    }));

    await page.goto('/register');
    await page.fill('input[name="name"]', 'Test Traveler');
    await page.fill('input[name="email"]', 'traveler@example.com');
    await page.fill('input[name="phone"]', '+919876543210');
    await page.fill('input[name="password"]', 'Password123!');
    await page.fill('input[name="confirmPassword"]', 'Password123!');
    await page.check('input[type="checkbox"]');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/auth\/otp/);
    await page.fill('input[placeholder*="OTP" i]', '123456');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('text=Featured Hotels')).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBe('register_token_123');
  });

  test('logs a user in end to end', async ({ page }) => {
    await mockHomeData(page);

    await page.route('**/api/v1/auth/login', (route) => route.fulfill({
      json: makeApiResponse({
        accessToken: 'login_token_123',
        user: {
          _id: 'user_456',
          name: 'Existing User',
          email: 'existing@example.com',
          role: 'user',
        },
      }, 'Login successful'),
    }));

    await page.goto('/login');
    await page.fill('input[name="email"]', 'existing@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('text=Featured Hotels')).toBeVisible();

    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBe('login_token_123');
  });

  test('shows the backend error when login fails', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) => route.fulfill({
      status: 401,
      json: {
        success: false,
        message: 'Invalid email or password',
      },
    }));

    await page.goto('/login');
    await page.fill('input[name="email"]', 'wrong@example.com');
    await page.fill('input[name="password"]', 'Password123!');
    await page.click('button[type="submit"]');

    await expect(page.locator('[role="alert"]')).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/\/login/);
  });
});
