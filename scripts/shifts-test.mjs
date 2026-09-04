import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/All-round-app/';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 400, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(base + '#/shifts/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.getByRole('button', { name: /Ranní \/ Odpolední/ }).click();
await page.waitForTimeout(800);
console.log('typy založeny:', (await page.locator('text=Odpolední').count()) > 0);

await page.getByRole('button', { name: /Přidat rotaci/ }).click();
await page.waitForTimeout(400);
const sheet = page.getByRole('dialog');
await sheet.locator('input[type="text"]').first().fill('Dvanáctky');
const slot = (label) => sheet.locator('button').filter({ hasText: new RegExp('^\\+ ' + label + '$') }).first();
for (const code of ['R', 'R', 'N', 'N', 'Volno', 'Volno']) {
  await slot(code).click();
  await page.waitForTimeout(120);
}
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/shots/pattern.png' });

await page.getByRole('button', { name: /Rozgenerovat/ }).click();
await page.waitForTimeout(2500);
const status = await page.locator('text=/Hotovo, zapsáno/').textContent().catch(() => 'nenalezeno');
console.log('rozgenerování:', status);

await page.goto(base + '#/shifts', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: '/tmp/shots/shifts.png', fullPage: true });
console.log('--- ŠICHTY ---\n' + (await page.locator('body').innerText()).slice(0, 900));

await page.goto(base + '#/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shots/today.png' });
console.log('--- DNES ---\n' + (await page.locator('body').innerText()).slice(0, 400));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
