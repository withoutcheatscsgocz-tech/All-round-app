/** Ověří, že se appka po instalaci service workeru načte i bez sítě. */
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';
const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
// Service worker se tentokrát nechává běžet — právě o něj tu jde.
const context = await browser.newContext({ viewport: { width: 400, height: 900 } });
const page = await context.newPage();

await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const swReady = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(reg?.active);
});
console.log('service worker aktivní:', swReady);

await context.setOffline(true);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').trim();
console.log('offline se vykreslilo:', text.slice(0, 120) || '(prázdné)');
await page.screenshot({ path: '/tmp/shots/offline.png' });

await context.setOffline(false);
await browser.close();
process.exit(swReady && text.length > 20 ? 0 : 1);
