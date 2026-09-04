/** Průchod modulem Recepty: import z webu, přepočet porcí, nákupní seznam. */
import { chromium } from 'playwright';

const base = process.env.APP_URL || 'http://127.0.0.1:4173/All-round-app/';

const RECIPE_PAGE = `<html><head>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Recipe",
 "name":"Svíčková na smetaně",
 "description":"Nedělní klasika.",
 "recipeYield":"4 porce",
 "prepTime":"PT40M","cookTime":"PT2H",
 "keywords":"omáčka, nedělní oběd",
 "recipeIngredient":["1,5 kg hovězí zadní","250 g mrkve","150 g celeru",
                     "2 lžíce cukru","1 dl smetany","sůl"],
 "recipeInstructions":[{"@type":"HowToStep","text":"Maso prošpikuj a osol."},
                       {"@type":"HowToStep","text":"Zeleninu orestuj."},
                       {"@type":"HowToStep","text":"Duste dvě hodiny."}]}
</script></head><body>Svíčková</body></html>`;

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const context = await browser.newContext({
  viewport: { width: 400, height: 900 },
  deviceScaleFactor: 2,
  serviceWorkers: 'block',
});
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// Cizí web nahradíme stránkou se skutečnou strukturou schema.org.
await page.route('**recepty.example.cz/**', (route) =>
  route.fulfill({ status: 200, contentType: 'text/html', body: RECIPE_PAGE }));

await page.goto(base + '#/recipes', { waitUntil: 'networkidle' });
await page.waitForTimeout(500);

await page.getByRole('button', { name: /Načíst z webu/ }).click();
await page.waitForTimeout(400);
const dialog = page.getByRole('dialog');
await dialog.locator('input[type="url"]').fill('https://recepty.example.cz/svickova');
await dialog.getByRole('button', { name: 'Načíst', exact: true }).first().click();
await page.waitForTimeout(2000);
await page.screenshot({ path: '/tmp/shots/recipe-detail.png', fullPage: true });
console.log('--- IMPORTOVANÝ RECEPT ---\n' + (await page.locator('body').innerText()).slice(0, 800));

// Přepočet ze 4 na 6 porcí
for (let i = 0; i < 2; i += 1) {
  await page.getByRole('button', { name: '+', exact: true }).first().click();
  await page.waitForTimeout(200);
}
const scaled = await page.locator('body').innerText();
console.log('\n--- PO PŘEPOČTU NA 6 PORCÍ ---\n' + scaled.slice(scaled.indexOf('SUROVINY'), scaled.indexOf('SUROVINY') + 320));

await page.getByRole('button', { name: /Přidat na nákupní seznam/ }).click();
await page.waitForTimeout(900);

await page.goto(base + '#/recipes/shopping', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.screenshot({ path: '/tmp/shots/shopping.png', fullPage: true });
console.log('\n--- NÁKUPNÍ SEZNAM ---\n' + (await page.locator('body').innerText()).slice(0, 400));

console.log(errors.length ? '\nCHYBY:\n' + errors.join('\n') : '\nŽádné chyby v konzoli.');
await browser.close();
