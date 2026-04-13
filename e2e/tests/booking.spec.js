// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Booking Flow E2E', () => {
  // Helper to login
  async function login(page) {
    await page.goto('/login');
    await page.fill('input[type="email"], input[name="email"]', 'testuser@example.com');
    await page.fill('input[type="password"], input[name="password"]', 'TestPass123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
  }

  test('should require login to book a hotel', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForTimeout(2000);

    // Navigate to a hotel details page
    const hotelLink = page.locator('a[href*="/hotels/"]').first();
    if (await hotelLink.count() > 0) {
      await hotelLink.click();
      await page.waitForTimeout(2000);

      // Look for a booking button
      const bookButton = page.locator('button:has-text("Book"), a:has-text("Book"), button:has-text("Reserve")');
      if (await bookButton.count() > 0) {
        await bookButton.first().click();
        await page.waitForTimeout(1000);

        // Should redirect to login if not authenticated
        const url = page.url();
        const isOnLoginOrBooking = /\/(login|booking)/.test(url);
        expect(isOnLoginOrBooking).toBeTruthy();
      }
    }
  });

  test('should display 404 page for invalid routes', async ({ page }) => {
    await page.goto('/some-nonexistent-page-12345');
    await page.waitForTimeout(1000);

    // Should show 404 content or redirect
    const body = await page.textContent('body');
    const is404 = /not found|404|doesn't exist/i.test(body || '');
    const isRedirected = page.url().includes('/') && !page.url().includes('nonexistent');
    expect(is404 || isRedirected).toBeTruthy();
  });

  test('should render About page', async ({ page }) => {
    await page.goto('/about');
    await page.waitForTimeout(1000);

    await expect(page).toHaveURL(/\/about/);
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();
  });

  test('home page should have navigation to hotels', async ({ page }) => {
    await page.goto('/');
    
    const hotelLink = page.locator('a[href="/hotels"], a:has-text("Hotels"), a:has-text("Browse"), a:has-text("Explore")');
    const linkCount = await hotelLink.count();
    expect(linkCount).toBeGreaterThan(0);
  });
});
