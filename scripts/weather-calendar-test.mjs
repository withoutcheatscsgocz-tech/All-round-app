/** Počasí proti skutečné odpovědi Open-Meteo a kalendář slučující tři zdroje. */
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';

const GEO = { results: [
  { name: 'Brno', latitude: 49.19522, longitude: 16.60796, country: 'Česko', admin1: 'Jihomoravský kraj' },
  { name: 'Brno-venkov', latitude: 49.1, longitude: 16.5, country: 'Česko', admin1: 'Jihomoravský kraj' },
]};

const hours = Array.from({ length: 48 }, (_, i) => {
  const d = new Date(Date.now() - 3 * 3600e3 + i * 3600e3);
  return d.toISOString().slice(0, 13) + ':00';
});
const FORECAST = {
  utc_offset_seconds: 7200,
  current: { time: hours[3], temperature_2m: 25.5, apparent_temperature: 25.8,
             weather_code: 61, wind_speed_10m: 2.4, precipitation: 0.2 },
  hourly: {
    time: hours,
    temperature_2m: hours.map((_, i) => 18 + (i % 12)),
    weather_code: hours.map((_, i) => (i % 4 === 0 ? 61 : 2)),
    precipitation_probability: hours.map((_, i) => (i % 4 === 0 ? 65 : 5)),
  },
  daily: {
    time: Array.from({ length: 7 }, (_, i) =>
      new Date(Date.now() + i * 864e5).toISOString().slice(0, 10)),
    weather_code: [61, 2, 0, 3, 95, 71, 45],
    temperature_2m_max: [30.3, 28, 26.4, 24, 21, 19, 17],
    temperature_2m_min: [18.6, 17, 16, 15, 13, 11, 9],
    precipitation_sum: [2.4, 0, 0, 0.2, 8, 1, 0],
    sunrise: Array(7).fill('2026-09-04T06:14'),
    sunset: Array(7).fill('2026-09-04T19:30'),
  },
};

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

// Playwright zkouší routy od naposledy přidané, a glob pro předpověď by
// zachytil i geocoding — proto se geocoding registruje jako druhý.
await context.route('**api.open-meteo.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FORECAST) }));
await context.route('**geocoding-api.open-meteo.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(GEO) }));

await page.goto(base + '#/weather', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
await page.getByRole('button', { name: /Vybrat město/ }).click();
await page.waitForTimeout(400);
const dialog = page.getByRole('dialog');
await dialog.locator('input').last().fill('Brno');
await page.waitForTimeout(1200);
await dialog.locator('ul li button').first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/shots/weather.png', fullPage: true });
const w = await page.locator('body').innerText();
console.log('--- POČASÍ ---\n' + w.slice(0, 500));

// Kalendář: šichty už v databázi jsou z dřívějška, přidáme událost
await page.goto(base + '#/calendar', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.locator('header button').last().click();
await page.waitForTimeout(400);
const ev = page.getByRole('dialog');
await ev.locator('input[type="text"]').first().fill('Kino s klukama');
await ev.locator('input[type="checkbox"]').first().uncheck();
await page.waitForTimeout(200);
await ev.locator('input[type="time"]').first().fill('18:30');
await ev.getByRole('button', { name: 'Uložit' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shots/calendar.png', fullPage: true });
const c = await page.locator('body').innerText();
console.log('\n--- KALENDÁŘ ---\n' + c.slice(c.indexOf('CO TĚ ČEKÁ'), c.indexOf('CO TĚ ČEKÁ') + 400));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
