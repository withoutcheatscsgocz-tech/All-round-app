/** Ověří obrazovky Spotify a YouTube včetně přehrávání vloženého videa. */
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

// Cizí skripty a přehrávač ven nepustíme, jen ověříme, že se o ně appka pokusí.
const asked = new Set();
for (const pattern of ['**sdk.scdn.co/**', '**accounts.google.com/**', '**youtube-nocookie.com/**', '**i.ytimg.com/**']) {
  await context.route(pattern, (route) => {
    asked.add(new URL(route.request().url()).host);
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>ok</body></html>' });
  });
}

await page.goto(base + '#/music', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);

await page.getByRole('button', { name: /Spotify/ }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: '/tmp/shots/spotify-setup.png', fullPage: true });
const spotify = await page.locator('body').innerText();
console.log('--- SPOTIFY ---\n' + spotify.slice(spotify.indexOf('SPOTIFY'), spotify.indexOf('SPOTIFY') + 700));

await page.getByRole('button', { name: /YouTube/ }).first().click();
await page.waitForTimeout(500);
await page.getByRole('button', { name: /Přidat odkaz/ }).click();
await page.waitForTimeout(300);
const dialog = page.getByRole('dialog');
await dialog.locator('input[type="url"]').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLtest12345');
await dialog.locator('input[type="text"]').last().fill('Testovací playlist');
await dialog.getByRole('button', { name: 'Uložit' }).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: '/tmp/shots/youtube.png', fullPage: true });

const iframe = await page.locator('iframe').getAttribute('src').catch(() => null);
console.log('\nvložený přehrávač:', iframe);
const yt = await page.locator('body').innerText();
console.log('--- YOUTUBE ---\n' + yt.slice(yt.indexOf('YOUTUBE'), yt.indexOf('YOUTUBE') + 400));
console.log('\noslovené cizí hosty:', [...asked].join(', ') || 'žádné');

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
