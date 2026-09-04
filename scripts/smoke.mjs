/**
 * Jeden průchod celou appkou: každý modul se vykreslí, ucelený scénář
 * projde napříč (šichta → součet → dashboard) a kontroluje se, že v konzoli
 * nespadne ani jedna chyba. Cizí API se odchytávají, prohlížeč v kontejneru
 * stejně ven nesmí.
 *
 *   npm run preview -- --port 4173 --host 127.0.0.1
 *   node scripts/smoke.mjs [--dark] [--lang en]
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';
const dark = process.argv.includes('--dark');
const lang = process.argv.includes('en') ? 'en' : 'cs';

const transitFixtures = new URL('../src/modules/transit/__fixtures__/', import.meta.url);
const fixture = (name) => readFileSync(new URL(name, transitFixtures), 'utf8');

const OPEN_METEO = {
  current: { time: '2026-09-04T20:00', temperature_2m: 22.5, apparent_temperature: 22,
             weather_code: 2, wind_speed_10m: 3, precipitation: 0 },
  hourly: { time: ['2026-09-04T20:00'], temperature_2m: [22], weather_code: [2],
            precipitation_probability: [5] },
  daily: { time: ['2026-09-04'], weather_code: [2], temperature_2m_max: [26],
           temperature_2m_min: [15], precipitation_sum: [0],
           sunrise: ['2026-09-04T06:14'], sunset: ['2026-09-04T19:30'] },
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const context = await browser.newContext({
  viewport: { width: 400, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: 'block',
  colorScheme: dark ? 'dark' : 'light',
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await context.route('**api.transitous.org/**', (route) => {
  const url = route.request().url();
  const body = url.includes('/geocode') ? fixture('geocode.json')
    : url.includes('/plan') ? fixture('plan.json')
    : url.includes('/stoptimes') ? fixture('stoptimes.json')
    : '{}';
  return route.fulfill({ status: 200, contentType: 'application/json', body });
});
await context.route('**open-meteo.com/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(OPEN_METEO) }));
// Cokoli dalšího ven (TMDB, Spotify, YouTube) se nemá pokoušet o síť.
for (const host of ['**themoviedb.org/**', '**api.spotify.com/**', '**googleapis.com/**',
                    '**image.tmdb.org/**', '**sdk.scdn.co/**', '**accounts.google.com/**']) {
  await context.route(host, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
}

async function visit(hash, label) {
  await page.goto(base + '#/' + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  const ok = text.length > 20;
  console.log(`${ok ? '✓' : '✗'} /${hash.padEnd(18)} ${label}: ${text.slice(0, 70)}…`);
  return ok;
}

// Nejdřív jazyk a téma
await page.goto(base + '#/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
if (lang === 'en') {
  await page.locator('select').first().selectOption('en');
  await page.waitForTimeout(600);
}
if (dark) {
  await page.locator('select').nth(1).selectOption('dark');
  await page.waitForTimeout(400);
}

// Založit šichty a jednu směnu, ať je co počítat
await page.goto(base + '#/shifts/settings', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const seed = page.locator('button').filter({ hasText: /Ranní|06:00/ }).first();
if (await seed.count()) {
  await seed.click();
  await page.waitForTimeout(800);
}

await page.goto(base + '#/shifts', { waitUntil: 'networkidle' });
await page.waitForTimeout(700);
const todayCell = page.locator('button').filter({ hasText: new RegExp(`^${new Date().getDate()}`) }).first();
if (await todayCell.count()) {
  await todayCell.click();
  await page.waitForTimeout(500);
  const save = page.getByRole('dialog').locator('button').filter({ hasText: /Uložit|Save/ }).first();
  if (await save.count()) {
    await save.click();
    await page.waitForTimeout(900);
  }
}
const shiftText = await page.locator('body').innerText();
const hasHours = /\d+(\.\d+)? h/.test(shiftText);
console.log(`${hasHours ? '✓' : '✗'} šichta se propsala do měsíčního součtu`);

let allOk = hasHours;
const pages = [
  ['today', 'Dnes'], ['shifts', 'Šichty'], ['shifts/settings', 'Nastavení šicht'],
  ['transit', 'Spoje'], ['recipes', 'Recepty'], ['recipes/shopping', 'Nákupní seznam'],
  ['recipes/plan', 'Plán jídel'], ['music', 'Hudba'], ['watch', 'Filmy'],
  ['notes', 'Poznámky'], ['expenses', 'Výdaje'], ['weather', 'Počasí'],
  ['calendar', 'Kalendář'], ['settings', 'Nastavení'],
];
for (const [hash, label] of pages) {
  allOk = (await visit(hash, label)) && allOk;
}

await page.goto(base + '#/today', { waitUntil: 'networkidle' });
await page.waitForTimeout(900);
await page.screenshot({
  path: `/tmp/shots/smoke-${lang}-${dark ? 'dark' : 'light'}.png`,
  fullPage: true,
});

console.log(errors.length ? `\n✗ CHYBY V KONZOLI:\n${errors.join('\n')}` : '\n✓ Žádné chyby v konzoli.');
await browser.close();
process.exit(allOk && errors.length === 0 ? 0 : 1);
