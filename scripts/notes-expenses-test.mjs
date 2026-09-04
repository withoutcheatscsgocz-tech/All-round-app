/** Průchod poznámkami, úkoly a výdaji včetně propojení s výdělkem ze šicht. */
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const context = await browser.newContext({
  viewport: { width: 400, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Úkoly
await page.goto(base + '#/notes', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
for (const text of ['Koupit chleba', 'Zavolat doktorovi', 'Vyzvednout balík']) {
  await page.locator('input[placeholder*="Rychle"]').fill(text);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
}
await page.screenshot({ path: '/tmp/shots/notes.png', fullPage: true });
const notes = await page.locator('body').innerText();
console.log('--- ÚKOLY ---\n' + notes.slice(0, 350));

// Termín na dnes u prvního úkolu, ať se objeví na dashboardu
await page.locator('button').filter({ hasText: 'Koupit chleba' }).first().click();
await page.waitForTimeout(500);
const dialog = page.getByRole('dialog');
const today = new Date().toISOString().slice(0, 10);
await dialog.locator('input[type="date"]').fill(today);
await dialog.getByRole('button', { name: 'Uložit' }).click();
await page.waitForTimeout(700);

// Výdaje
await page.goto(base + '#/expenses', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const rows = [['850', 'transport'], ['1240', 'food'], ['320', 'fun'], ['2100', 'home']];
for (const [amount, category] of rows) {
  await page.locator('header button').last().click();
  await page.waitForTimeout(400);
  const sheet = page.getByRole('dialog');
  await sheet.locator('input[type="number"]').fill(amount);
  await sheet.locator('select').selectOption(category);
  await sheet.getByRole('button', { name: 'Uložit' }).click();
  await page.waitForTimeout(600);
}
await page.screenshot({ path: '/tmp/shots/expenses.png', fullPage: true });
const exp = await page.locator('body').innerText();
console.log('\n--- VÝDAJE ---\n' + exp.slice(0, 600));

// Dashboard
await page.goto(base + '#/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shots/dashboard.png', fullPage: true });
console.log('\n--- DNES ---\n' + (await page.locator('body').innerText()).slice(0, 600));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
