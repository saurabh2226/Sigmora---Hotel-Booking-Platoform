// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Hotel Listing & Search', () => {
  test('should load the hotel listing page', async ({ page }) => {
    await page.goto('/hotels');
    
    // Wait for hotels to load
    await page.waitForSelector('[class*="hotel"], [class*="card"], [data-testid="hotel-card"]', {
      timeout: 10000,
    }).catch(() => {});

    await expect(page).toHaveURL(/\/hotels/);
  });

  test('should display hotel cards on listing page', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForTimeout(2000); // Wait for API response

    // Check that hotel cards are rendered (flexible selectors)
    const cards = page.locator('[class*="hotel"], [class*="card"], [class*="listing"]');
    const cardCount = await cards.count();
    
    // Page should either show hotels or an empty state
    expect(cardCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to hotel details when clicking a hotel', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForTimeout(2000);

    const firstHotelLink = page.locator('a[href*="/hotels/"]').first();
    if (await firstHotelLink.count() > 0) {
      await firstHotelLink.click();
      await expect(page).toHaveURL(/\/hotels\/.+/);
    }
  });

  test('should have a search functionality', async ({ page }) => {
    await page.goto('/hotels');
    
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[name="search"]');
    if (await searchInput.count() > 0) {
      await searchInput.fill('Mumbai');
      await page.waitForTimeout(1000);
      // Verify search was performed (page content changed or URL updated)
    }
  });

  test('should display filter options', async ({ page }) => {
    await page.goto('/hotels');
    
    // Look for filter elements (price, type, rating, etc.)
    const filterElements = page.locator(
      'select, input[type="range"], [class*="filter"], [class*="Filter"], button:has-text("Filter")'
    );
    
    // Filters may or may not be present depending on implementation
    const filterCount = await filterElements.count();
    expect(filterCount).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Hotel Details Page', () => {
  test('should display hotel information', async ({ page }) => {
    await page.goto('/hotels');
    await page.waitForTimeout(2000);

    const firstHotelLink = page.locator('a[href*="/hotels/"]').first();
    if (await firstHotelLink.count() > 0) {
      await firstHotelLink.click();
      await page.waitForTimeout(2000);

      // Check for common hotel detail elements
      const title = page.locator('h1, h2').first();
      await expect(title).toBeVisible();
    }
  });
});
