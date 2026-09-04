/** Průchod modulem Filmy proti mockovanému TMDB (klíč není v repu). */
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';

const SEARCH = { results: [
  { id: 1396, media_type: 'tv', name: 'Perníkový táta', first_air_date: '2008-01-20',
    poster_path: '/p1.jpg', overview: 'Učitel chemie…', vote_average: 8.9 },
  { id: 603, media_type: 'movie', title: 'Matrix', release_date: '1999-03-30',
    poster_path: '/p2.jpg', overview: 'Neo zjistí…', vote_average: 8.2 },
  { id: 5, media_type: 'person', name: 'Bryan Cranston' },
]};
const PROVIDERS = { id: 1396, results: { CZ: {
  link: 'https://www.themoviedb.org/tv/1396/watch?locale=CZ',
  flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 3 }],
  rent: [{ provider_id: 3, provider_name: 'Google Play Movies', display_priority: 1 }],
}}};
const TV = { seasons: [
  { season_number: 0, name: 'Speciály', episode_count: 4 },
  { season_number: 1, name: 'Sezóna 1', episode_count: 7 },
  { season_number: 2, name: 'Sezóna 2', episode_count: 13 },
]};
const EPISODES = { episodes: Array.from({ length: 7 }, (_, i) => ({
  episode_number: i + 1, name: `Díl ${i + 1}`, air_date: '2008-01-20',
}))};

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

await context.route('**api.themoviedb.org/**', (route) => {
  const url = route.request().url();
  const body =
    url.includes('/watch/providers') ? PROVIDERS
    : /\/tv\/\d+\/season\//.test(url) ? EPISODES
    : /\/tv\/\d+\?/.test(url) ? TV
    : SEARCH;
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
});
await context.route('**image.tmdb.org/**', (route) =>
  route.fulfill({ status: 200, contentType: 'image/gif',
    body: Buffer.from('R0lGODlhAQABAAAAACw=', 'base64') }));

await page.goto(base + '#/watch', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/watch-setup.png', fullPage: true });

await page.locator('input').first().fill('test-klic-tmdb');
await page.getByRole('button', { name: 'Uložit' }).click();
await page.waitForTimeout(900);

await page.getByRole('button', { name: 'Hledat', exact: true }).click();
await page.waitForTimeout(400);
await page.locator('input[placeholder*="Hledat film"]').fill('pernikovy');
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shots/watch-search.png', fullPage: true });
console.log('--- HLEDÁNÍ ---\n' + (await page.locator('body').innerText()).slice(0, 350));

await page.locator('button').filter({ hasText: 'Perníkový táta' }).first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/shots/watch-detail.png', fullPage: true });
const detail = await page.locator('body').innerText();
console.log('\n--- DETAIL ---\n' + detail.slice(0, 700));

const netflix = await page.locator('a', { hasText: 'Netflix' }).getAttribute('href');
console.log('\nodkaz na Netflix:', netflix);

// Rozbalit sezónu a odškrtnout díl
await page.locator('button').filter({ hasText: /^Sezóna 1/ }).first().click();
await page.waitForTimeout(1200);
await page.locator('button').filter({ hasText: /1×01/ }).first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shots/watch-episodes.png', fullPage: true });
const after = await page.locator('body').innerText();
console.log('\n--- SEZÓNY ---\n' + after.slice(after.indexOf('SEZÓNY'), after.indexOf('SEZÓNY') + 300));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
