# All-round app — poznámky pro Clauda

Osobní PWA, kde má uživatel na jednom místě recepty, hudbu, spoje, šichty,
filmy, poznámky, výdaje, počasí a kalendář.

## Trvalá pravidla

- **Po každém dokončeném úkolu navrhnout, jak appku dál vylepšit.** Uživatel si to
  výslovně vyžádal — vždycky na konci odpovědi přidat konkrétní návrhy dalších kroků.
- Uživatel mluví česky. **UI je česky (výchozí) i anglicky**, komentáře v kódu česky.
- Vývoj probíhá na větvi `claude/all-in-one-personal-app-e4fm4v`.

## Architektura

- **Vite + React 19 + TypeScript + Tailwind v4**, statická PWA na GitHub Pages
  (`base: '/All-round-app/'`, proto `HashRouter`).
- **Žádný backend.** Všechna data jsou v prohlížeči v IndexedDB přes Dexie
  (`src/db/db.ts`). Záloha = export/import JSON (`src/db/backup.ts`).
- **Moduly** se registrují samy: `src/modules/<jméno>/index.ts` zavolá
  `registerModule()` a přidá se import do `src/modules/index.ts`. Z registru se
  generuje navigace, routy i karty na úvodní obrazovce. Přidat modul = jeden
  adresář + jeden řádek.
- **i18n**: `src/i18n/cs.ts` je zdroj pravdy, `en.ts` může být neúplná
  (chybějící klíč spadne do češtiny). Typy klíčů se odvozují automaticky —
  překlep v `t('...')` neprojde kompilací.
- **Data z internetu** se tahají přímo z prohlížeče (všechna použitá API mají
  otevřené CORS) a cachují přes `src/lib/cache.ts`.

## Klíče a účty

Nic se necommituje. Spotify Client ID, Google Client ID a TMDB klíč zadává
uživatel v Nastavení a ukládají se do IndexedDB. Spotify i Google používají
PKCE, takže client secret není potřeba.

## Příkazy

```bash
npm run dev      # vývoj
npm run test     # vitest, čistá logika (mzdy, svátky, parsování)
npm run build    # typová kontrola + produkční build
```

Čistá logika (výpočty mezd, svátky, přepočty porcí, parsování odpovědí API)
patří do samostatných souborů s testy, ne do komponent.

## Testování v prohlížeči

`scripts/*.mjs` jsou Playwright skripty (Chromium je předinstalovaný v
`/opt/pw-browsers/`). Spouští se proti `npm run preview` na
`http://127.0.0.1:4173/All-round-app/`.

Dvě věci, o které se člověk v tomhle kontejneru spolehlivě praští:

- **Prohlížeč nesmí ven.** Agent proxy resetuje spojení navazovaná
  z Chromia, i když curl přes `$HTTPS_PROXY` funguje. Volání cizích API se
  proto v testech odchytávají přes `page.route()` a odpovídá se
  fixtures se skutečnými odpověďmi (`src/modules/*/__fixtures__/`).
- **Service worker odchytí fetch dřív než `page.route()`.** Kontext se musí
  vytvořit s `serviceWorkers: 'block'`, jinak interception nic nezachytí.
