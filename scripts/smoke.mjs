import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/All-round-app/';
const routes = process.argv.slice(2);
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  // Ven z kontejneru se chodí přes agent proxy; jeho CA je už v NSS storu.
  // Playwright by jinak poslal přes proxy i localhost, proto bypass.
  proxy: process.env.HTTPS_PROXY
    ? { server: process.env.HTTPS_PROXY, bypass: '127.0.0.1,localhost' }
    : undefined,
});
const page = await browser.newPage({ viewport: { width: 400, height: 850 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

for (const r of routes.length ? routes : ['']) {
  await page.goto(base + '#/' + r, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const name = r.replace(/\//g, '_') || 'home';
  await page.screenshot({ path: `/tmp/shots/${name}.png` });
  const text = await page.locator('body').innerText();
  console.log(`--- /${r} ---\n${text.slice(0, 400)}\n`);
}
console.log(errors.length ? 'CHYBY:\n' + errors.join('\n') : 'Žádné chyby v konzoli.');
await browser.close();
