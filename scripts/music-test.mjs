/** Ověří, že hudba hraje dál i po přepnutí modulu a že ji ovládá mini lišta. */
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';

// Krátký syntetický WAV, ať se nemusí nic stahovat.
execSync(`python3 - <<'PY'
import struct, math, wave
with wave.open('/tmp/tone.wav','w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000)
    w.writeframes(b''.join(struct.pack('<h', int(8000*math.sin(i*0.05))) for i in range(8000*4)))
PY`, { shell: '/bin/bash' });

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({
  viewport: { width: 400, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block',
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

await page.goto(base + '#/music', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

await page.locator('input[type="file"]').setInputFiles(['/tmp/tone.wav']);
await page.waitForTimeout(2500);
console.log('--- HUDBA ---\n' + (await page.locator('body').innerText()).slice(0, 300));

await page.getByRole('button', { name: /Přehrát vše/ }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: '/tmp/shots/music.png', fullPage: true });

// Audio element je záměrně mimo DOM (new Audio()), takže stav čteme z mini lišty.
const state = async () => ({
  hraje: (await page.locator('button[aria-label="⏸"]').count()) > 0,
  popisek: await page.locator('.fixed p.truncate').first().innerText().catch(() => '—'),
});
console.log('na stránce Hudba:', JSON.stringify(await state()));

// Přepnout na jiný modul a ověřit, že hudba běží dál
await page.goto(base + '#/shifts', { waitUntil: 'networkidle' });
await page.waitForTimeout(1800);
console.log('po přepnutí na Šichty:', JSON.stringify(await state()));
await page.screenshot({ path: '/tmp/shots/miniplayer.png' });
// Pauza z mini lišty na cizí stránce musí fungovat taky.
await page.locator('button[aria-label="⏸"]').click();
await page.waitForTimeout(500);
console.log('po pauze z mini lišty:', JSON.stringify(await state()));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
