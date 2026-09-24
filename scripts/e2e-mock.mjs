// One-off end-to-end smoke test for mock mode.
// Usage: MOCK_MODE=1 NEXT_PUBLIC_MOCK_MODE=1 ALLOWED_EMAIL=test@example.com AUTH_SECRET=dev npm run dev
// (in one terminal), then: node scripts/e2e-mock.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const SCREENSHOT_PATH = path.join(process.cwd(), 'docs', 'screenshot.png');

const consoleErrors = [];
const pageErrors = [];

function assert(cond, message) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok: ${message}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
  });
  const page = await browser.newPage();

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  console.log('1. Load board');
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Job Kanban');
  await page.waitForSelector('text=Applied');
  await page.waitForSelector('text=Acme Corp', { timeout: 15000 });

  const expectedCompanies = ['Acme Corp', 'Nimbus Data', 'Initech', 'Bluepeak Analytics'];
  for (const company of expectedCompanies) {
    assert(await page.locator(`text=${company}`).first().isVisible(), `column shows ${company}`);
  }

  console.log('2. Click a card (Acme Corp) and edit role');
  await page.locator('text=Acme Corp').first().click();
  await page.waitForSelector('text=Application details');
  const roleInput = page.locator('label:has-text("Role") input');
  await roleInput.fill('Staff Backend Engineer');
  await page.locator('button:has-text("Save")').click();
  await page.waitForSelector('text=Saved', { timeout: 5000 });
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForSelector('text=Application details', { state: 'detached' });
  assert(
    await page.locator('text=Staff Backend Engineer').first().isVisible(),
    'card shows updated role'
  );

  console.log('3. Change status via select and confirm card moves column');
  await page.locator('text=Acme Corp').first().click();
  await page.waitForSelector('text=Application details');
  await page.locator('label:has-text("Status") select').selectOption('offer');
  await page.locator('button:has-text("Save")').click();
  await page.waitForSelector('text=Saved', { timeout: 5000 });
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForSelector('text=Application details', { state: 'detached' });
  const offerColumn = page.locator('div.grid > div', { hasText: 'Offer' }).first();
  assert(
    await offerColumn.locator('text=Acme Corp').first().isVisible(),
    'Acme Corp card is now in the Offer column'
  );

  console.log('4. Mark not job-related, confirm disappears then reappears with Show ignored');
  await page.locator('text=Nimbus Data').first().click();
  await page.waitForSelector('text=Application details');
  await page.locator('button:has-text("Mark not job-related")').click();
  await page.waitForSelector('text=Saved', { timeout: 5000 });
  await page.locator('button[aria-label="Close"]').click();
  await page.waitForSelector('text=Application details', { state: 'detached' });
  await page.waitForTimeout(300);
  assert(
    (await page.locator('text=Nimbus Data').count()) === 0,
    'Nimbus Data hidden after marking ignored'
  );
  await page.locator('label:has-text("Show ignored")').click();
  await page.waitForSelector('text=Nimbus Data', { timeout: 5000 });
  assert(
    await page.locator('text=Nimbus Data').first().isVisible(),
    'Nimbus Data reappears with Show ignored checked'
  );

  console.log('5. Click Sync now, confirm no error');
  await page.locator('button:has-text("Sync now")').click();
  await page.waitForTimeout(2000);
  const errorToast = await page.locator('text=Sync error').count();
  assert(errorToast === 0, 'no sync error toast shown');

  console.log('6. Screenshot');
  fs.mkdirSync(path.dirname(SCREENSHOT_PATH), { recursive: true });
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  console.log(`  saved screenshot to ${SCREENSHOT_PATH}`);

  await browser.close();

  if (consoleErrors.length) {
    console.log('\nBrowser console errors observed:');
    for (const e of consoleErrors) console.log('  -', e);
  }
  if (pageErrors.length) {
    console.log('\nUncaught page errors observed:');
    for (const e of pageErrors) console.log('  -', e);
  }

  if (consoleErrors.length || pageErrors.length) {
    process.exitCode = 1;
  } else {
    console.log('\nAll checks passed, no console/page errors.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
