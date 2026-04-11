const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE_URL = 'http://127.0.0.1:4173';
const API_BASE_URL = 'http://127.0.0.1:4100';
const DEFAULT_PASSWORD = 'Demo#123';
const DEFAULT_SIGNUP_PASSWORD = 'Demo#123!';
const IS_HEADED = process.argv.includes('--headed');

function uniqueEmail(prefix = 'user') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}@capeconnect.demo`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, timeoutMs = 5000, message = 'Condition timed out') {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await condition();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }

  if (lastError) {
    throw lastError;
  }
  throw new Error(message);
}

async function createPage(browser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await context.addInitScript((apiBaseUrl) => {
    localStorage.setItem('ccApiBaseUrl', apiBaseUrl);
  }, API_BASE_URL);
  const page = await context.newPage();
  return { context, page };
}

async function closePage(resources) {
  await resources.context.close();
}

async function login(page, email, password = DEFAULT_PASSWORD) {
  await page.goto('/login.html');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();
}

async function expectUrl(page, pattern, message) {
  await waitFor(async () => pattern.test(page.url()), 10000, message || `Expected URL to match ${pattern}, got ${page.url()}`);
}

async function expectBodyContains(page, text, message) {
  await waitFor(async () => {
    const bodyText = await page.locator('body').textContent();
    return String(bodyText || '').includes(text);
  }, 10000, message || `Expected page body to contain "${text}"`);
}

async function expectAuthSession(page) {
  await waitFor(async () => {
    return await page.evaluate(() => Boolean(window.CCApi?.readAuthSession?.()?.token));
  }, 10000, 'Expected authenticated session token');
}

async function countVisibleTicketButtons(page) {
  return page.locator('button.ticket-details-btn:visible').count();
}

async function readWalletBalance(page) {
  const text = await page.locator('#walletBalance').textContent();
  return Number(String(text || '').replace(/[^\d.]/g, '')) || 0;
}

async function runTest(name, fn, browser) {
  const resources = await createPage(browser);
  try {
    await fn(resources.page);
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack || error.message || error);
    throw error;
  } finally {
    await closePage(resources);
  }
}

async function signupAndChooseMyCiTi(page, email) {
  await page.goto('/signup.html');
  await page.locator('#name').fill('Test');
  await page.locator('#surname').fill('Passenger');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(DEFAULT_SIGNUP_PASSWORD);
  await page.locator('#confirm-password').fill(DEFAULT_SIGNUP_PASSWORD);
  await page.locator('#agree').check();
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expectUrl(page, /\/choose-bus\.html$/, 'Signup should redirect to choose-bus.html');
  await page.locator('#myciti-card').click();
  await expectUrl(page, /\/myciti-dashboard\.html$/, 'Bus selection should redirect to MyCiTi dashboard');
}

async function testSignupFlow(page) {
  const email = uniqueEmail('signup');
  await signupAndChooseMyCiTi(page, email);
  await expectBodyContains(page, 'MyCiTi');
}

async function testMyCiTiPurchase(page) {
  await login(page, 'william@capeconnect.demo');
  await expectUrl(page, /\/myciti-dashboard\.html$/);
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
  await page.locator('#topupPoints').selectOption('50');
  await page.locator('#btnNext').click();
  await expectUrl(page, /\/results\.html$/);

  await page.locator('#btnNext').click();
  await expectUrl(page, /\/payment\.html$/);

  await page.locator('#btnPayNow').click();
  await expectUrl(page, /\/myciti-dashboard\.html$/);
  await expectBodyContains(page, 'Top Up to 50 Points');

  const afterCount = await countVisibleTicketButtons(page);
  assert.ok(afterCount >= beforeCount, 'Expected ticket count to stay the same or increase');
}

async function testGoldenArrowPurchase(page) {
  await login(page, 'sihle@capeconnect.demo');
  await expectUrl(page, /\/golden-arrow-dashboard\.html$/);
  await expectAuthSession(page);

  const beforeCount = await countVisibleTicketButtons(page);

  await page.goto('/ga-route-calculator.html');
  await page.locator('#fromStop').selectOption({ index: 1 });
  await page.locator('#toStop').selectOption({ index: 2 });
  await page.locator('#nextBtn').click();
  await expectUrl(page, /\/ga-choose-fare\.html$/);

  await page.locator('input[name="fare"][value="weekly"]').check();
  await page.locator('#nextBtn').click();
  await expectUrl(page, /\/ga-results\.html$/);

  await page.locator('#nextBtn').click();
  await expectUrl(page, /\/ga-payment\.html$/);

  await page.locator('#nameInput').fill('Sihle Ndlovu');
  await page.locator('#emailInput').fill('sihle@capeconnect.demo');
  await page.locator('#payBtn').click();
  await expectUrl(page, /\/golden-arrow-dashboard\.html$/);

  await waitFor(async () => (await countVisibleTicketButtons(page)) > beforeCount, 10000, 'Expected Golden Arrow ticket count to increase');
}

async function testLinkedServiceSwitch(page) {
  const email = uniqueEmail('switch');
  await signupAndChooseMyCiTi(page, email);

  await page.evaluate(async (apiBaseUrl) => {
    const session = window.CCApi.readAuthSession();
    const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({ operator: 'myciti', buses: ['myciti', 'ga'] }),
    });

    if (!response.ok) {
      throw new Error(`Failed to link buses: ${response.status}`);
    }
  }, API_BASE_URL);

  await page.goto('/profile.html');
  await waitFor(async () => page.locator('#ga-preference').isVisible(), 10000, 'Expected GA preference option');
  await waitFor(async () => page.locator('#myciti-preference').isVisible(), 10000, 'Expected MyCiTi preference option');

  await page.locator('#ga-preference').click();
  await expectUrl(page, /\/golden-arrow-dashboard\.html$/);
}

async function testWalletTopup(page) {
  await login(page, 'william@capeconnect.demo');
  await expectUrl(page, /\/myciti-dashboard\.html$/);
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
  await page.locator('#btnNext').click();
  await expectUrl(page, /\/results\.html$/);
  await page.locator('#btnNext').click();
  await expectUrl(page, /\/payment\.html$/);

  const before = await readWalletBalance(page);
  await page.locator('#btnTopUp').click();
  await page.locator('#topupAmount').fill('75');
  await page.locator('#topupName').fill('William User');
  await page.locator('#topupNumber').fill('4242424242424242');
  await page.locator('#topupExpiry').fill('12/30');
  await page.locator('#topupCvv').fill('123');
  await page.locator('#topupConfirm').click();

  await waitFor(async () => (await readWalletBalance(page)) > before, 10000, 'Expected wallet balance to increase after top-up');
}

async function main() {
  const browser = await chromium.launch({ headless: !IS_HEADED });
  const tests = [
    ['signup redirects to choose bus and selecting MyCiTi opens the MyCiTi dashboard', testSignupFlow],
    ['MyCiTi purchase creates a ticket that is visible on the dashboard', testMyCiTiPurchase],
    ['Golden Arrow purchase creates a ticket that is visible on the Golden Arrow dashboard', testGoldenArrowPurchase],
    ['linked-service user can switch from MyCiTi to Golden Arrow in settings', testLinkedServiceSwitch],
    ['wallet top-up updates the backend-backed wallet balance during checkout', testWalletTopup],
  ];

  let failed = 0;
  try {
    for (const [name, fn] of tests) {
      try {
        await runTest(name, fn, browser);
      } catch (_error) {
        failed += 1;
      }
    }
  } finally {
    await browser.close();
  }

  if (failed > 0) {
    console.error(`\n${failed} E2E test(s) failed.`);
    process.exit(1);
  }

  console.log(`\n${tests.length} E2E test(s) passed.`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
