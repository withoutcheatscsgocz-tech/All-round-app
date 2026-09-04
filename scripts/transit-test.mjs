/**
 * Projde modul Spoje v prohlížeči na skutečných odpovědích z Transitous
 * uložených jako fixtures. Volání se odchytávají, takže test je
 * deterministický a nepotřebuje internet.
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';
const fixtures = new URL('../src/modules/transit/__fixtures__/', import.meta.url);
const read = (name) => readFileSync(new URL(name, fixtures), 'utf8');

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// Service worker by fetch odchytil dřív než page.route, proto ho vypínáme.
const context = await browser.newContext({
  viewport: { width: 400, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: 'block',
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.route('**/api.transitous.org/**', (route) => {
  const url = route.request().url();
  const body =
    url.includes('/geocode') ? read('geocode.json')
    : url.includes('/plan') ? read('plan.json')
    : url.includes('/stoptimes') ? read('stoptimes.json')
    : '{}';
  return route.fulfill({ status: 200, contentType: 'application/json', body });
});

await page.goto(base + '#/transit', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

const stopInputs = page.locator('input[placeholder*="zastávky"]');
await stopInputs.first().fill('Brno hlavní');
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/shots/geocode.png' });
const suggestions = await page.locator('ul li button').allInnerTexts();
console.log('našeptávač:', JSON.stringify(suggestions.slice(0, 3)));
await page.locator('ul li button').first().click();
await page.waitForTimeout(300);

await stopInputs.last().fill('Praha hlavní');
await page.waitForTimeout(900);
await page.locator('ul li button').first().click();
await page.waitForTimeout(300);

await page.getByRole('button', { name: /Vyhledat$/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shots/transit-results.png', fullPage: true });
console.log('\n--- VÝSLEDKY ---\n' + (await page.locator('body').innerText()).slice(0, 600));

const firstResult = page.locator('button').filter({ hasText: /→ \d\d:\d\d/ }).first();
await firstResult.click();
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/transit-detail.png', fullPage: true });
console.log('\n--- DETAIL SPOJE ---\n' + (await page.locator('body').innerText()).slice(0, 900));

await page.getByRole('button', { name: /Přidat zastávku/ }).click();
await page.waitForTimeout(400);
const dialog = page.getByRole('dialog');
await dialog.locator('input').first().fill('Brno hlavní');
await page.waitForTimeout(900);
await dialog.locator('ul li button').first().click();
await page.waitForTimeout(300);
await dialog.getByRole('button', { name: 'Uložit' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shots/stopboard.png', fullPage: true });
const board = await page.locator('body').innerText();
const from = board.indexOf('OBLÍBENÉ');
console.log('\n--- TABULE ---\n' + board.slice(from, from + 500));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
