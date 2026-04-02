const { test, expect } = require('@playwright/test');

function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@capeconnect.demo`;
}

async function login(page, email, password = 'Demo#123') {
  await page.goto('/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function expectAuthSession(page) {
  await expect.poll(async () => {
    return await page.evaluate(() => Boolean(window.CCApi?.readAuthSession?.()?.token));
  }).toBe(true);
}

async function countVisibleTicketButtons(page) {
  return await page.locator('button.ticket-details-btn:visible').count();
}

async function readWalletBalance(page) {
  const text = await page.locator('#walletBalance').textContent();
  return Number(String(text || '').replace(/[^\d.]/g, '')) || 0;
}

test.describe('CapeConnect current frontend flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ccApiBaseUrl', 'http://127.0.0.1:4100');
    });
  });

  test('signup redirects to choose bus and selecting MyCiTi opens the MyCiTi dashboard', async ({ page }) => {
    const email = uniqueEmail('signup');

    await page.goto('/signup.html');
    await page.locator('#name').fill('Test');
    await page.locator('#surname').fill('Passenger');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('Demo#123!');
    await page.locator('#confirm-password').fill('Demo#123!');
    await page.locator('#agree').check();
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/choose-bus\.html$/);
    await page.locator('#myciti-card').click();

    await expect(page).toHaveURL(/\/myciti-dashboard\.html$/);
    await expect(page.locator('body')).toContainText('MyCiTi');
  });

  test('MyCiTi purchase creates a ticket that is visible on the dashboard', async ({ page }) => {
    await login(page, 'william@capeconnect.demo');
    await expect(page).toHaveURL(/\/myciti-dashboard\.html$/);
    await expectAuthSession(page);

    const beforeCount = await countVisibleTicketButtons(page);

    await page.evaluate(() => {
      sessionStorage.setItem('mycitiBooking', JSON.stringify({
        from: 'Civic Centre',
        to: 'Table View',
        speed: 25,
        factor: 1.25,
        topupPoints: 50,
        estimate: {
          from: { name: 'Civic Centre', lat: -33.9249, lon: 18.4241 },
          to: { name: 'Table View', lat: -33.8269, lon: 18.4909 },
          distanceKm: 16.4,
          travelMinutes: 39,
          period: 'Saver',
          fare: 18.5,
          points: 19,
          bandLabel: '10-20 km',
        },
      }));
    });
    await page.goto('/choose-fare.html');
    await expect(page).toHaveURL(/\/choose-fare\.html$/);
    await page.locator('#topupPoints').selectOption('50');
    await page.locator('#btnNext').click();

    await expect(page).toHaveURL(/\/results\.html$/);
    await page.locator('#btnNext').click();

    await expect(page).toHaveURL(/\/payment\.html$/);
    await page.locator('#btnPayNow').click();

    await expect(page).toHaveURL(/\/myciti-dashboard\.html$/);
    await expect(page.locator('body')).toContainText('Top Up to 50 Points');
  });

  test('Golden Arrow purchase creates a ticket that is visible on the Golden Arrow dashboard', async ({ page }) => {
    await login(page, 'sihle@capeconnect.demo');
    await expect(page).toHaveURL(/\/golden-arrow-dashboard\.html$/);
    await expectAuthSession(page);

    const beforeCount = await countVisibleTicketButtons(page);

    await page.goto('/ga-route-calculator.html');
    await expect(page).toHaveURL(/\/ga-route-calculator\.html$/);
    await page.locator('#fromStop').selectOption({ index: 1 });
    await page.locator('#toStop').selectOption({ index: 2 });
    await page.locator('#nextBtn').click();

    await expect(page).toHaveURL(/\/ga-choose-fare\.html$/);
    await page.locator('input[name="fare"][value="weekly"]').check();
    await page.locator('#nextBtn').click();

    await expect(page).toHaveURL(/\/ga-results\.html$/);
    await page.locator('#nextBtn').click();

    await expect(page).toHaveURL(/\/ga-payment\.html$/);
    await page.locator('#nameInput').fill('Sihle Ndlovu');
    await page.locator('#emailInput').fill('sihle@capeconnect.demo');
    await page.locator('#payBtn').click();

    await expect(page).toHaveURL(/\/golden-arrow-dashboard\.html$/);
    await expect.poll(async () => countVisibleTicketButtons(page)).toBeGreaterThan(beforeCount);
  });

  test('linked-service user can switch from MyCiTi to Golden Arrow in settings', async ({ page }) => {
    const email = uniqueEmail('switch');

    await page.goto('/signup.html');
    await page.locator('#name').fill('Link');
    await page.locator('#surname').fill('User');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('Demo#123!');
    await page.locator('#confirm-password').fill('Demo#123!');
    await page.locator('#agree').check();
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/choose-bus\.html$/);
    await page.locator('#myciti-card').click();
    await expect(page).toHaveURL(/\/myciti-dashboard\.html$/);

    await page.evaluate(async () => {
      const session = window.CCApi.readAuthSession();
      await fetch('http://127.0.0.1:4100/api/auth/me', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ operator: 'myciti', buses: ['myciti', 'ga'] }),
      });
    });

    await page.goto('/profile.html');
    await expect(page.locator('#ga-preference')).toBeVisible();
    await expect(page.locator('#myciti-preference')).toBeVisible();

    await page.locator('#ga-preference').click();
    await expect(page).toHaveURL(/\/golden-arrow-dashboard\.html$/);
  });

  test('wallet top-up updates the backend-backed wallet balance during checkout', async ({ page }) => {
    await login(page, 'william@capeconnect.demo');
    await expect(page).toHaveURL(/\/myciti-dashboard\.html$/);
    await expectAuthSession(page);

    await page.evaluate(() => {
      sessionStorage.setItem('mycitiBooking', JSON.stringify({
        from: 'Civic Centre',
        to: 'Table View',
        speed: 25,
        factor: 1.25,
        topupPoints: 50,
        estimate: {
          from: { name: 'Civic Centre', lat: -33.9249, lon: 18.4241 },
          to: { name: 'Table View', lat: -33.8269, lon: 18.4909 },
          distanceKm: 16.4,
          travelMinutes: 39,
          period: 'Saver',
          fare: 18.5,
          points: 19,
          bandLabel: '10-20 km',
        },
      }));
    });

    await page.goto('/choose-fare.html');
    await expect(page).toHaveURL(/\/choose-fare\.html$/);
    await page.locator('#btnNext').click();
    await expect(page).toHaveURL(/\/results\.html$/);
    await page.locator('#btnNext').click();
    await expect(page).toHaveURL(/\/payment\.html$/);

    const before = await readWalletBalance(page);
    await page.locator('#btnTopUp').click();
    await page.locator('#topupAmount').fill('75');
    await page.locator('#topupName').fill('William User');
    await page.locator('#topupNumber').fill('4242424242424242');
    await page.locator('#topupExpiry').fill('12/30');
    await page.locator('#topupCvv').fill('123');
    await page.locator('#topupConfirm').click();

    await expect.poll(async () => readWalletBalance(page)).toBeGreaterThan(before);
  });
});
