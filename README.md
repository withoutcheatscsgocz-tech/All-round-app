# All-round app

Jedna appka na všechno, co potřebuju: **recepty, hudba, spoje autobusů a vlaků,
rozpis šicht, filmy, poznámky, výdaje, počasí a kalendář.**

Běží jako **PWA** — nainstaluješ si ji na plochu telefonu a chová se jako normální
aplikace. Funguje i bez internetu. **Žádný server, žádné přihlašování, žádná
registrace** — všechna data jsou jen v tvém telefonu.

## Spuštění

```bash
npm install
npm run dev       # http://127.0.0.1:5173
```

Další příkazy:

```bash
npm run test      # testy výpočtů (mzdy, svátky, přepočty)
npm run build     # produkční build do dist/
npm run preview   # náhled produkčního buildu
```

## Nasazení na GitHub Pages

Push do `main` nebo do větve `claude/**` spustí workflow, který appku postaví
a nasadí. Jednorázově je potřeba v repozitáři zapnout:

**Settings → Pages → Build and deployment → Source: _GitHub Actions_**

Pak appka poběží na `https://<uživatel>.github.io/All-round-app/`. Na telefonu ji
otevřeš v prohlížeči a dáš **Přidat na plochu**.

## Data a záloha

Všechno je uložené v prohlížeči (IndexedDB). To znamená:

- data se **nikam neposílají** a nikdo jiný se k nim nedostane,
- appka funguje offline,
- ale data jsou **jen v tom jednom zařízení** a prohlížeč je teoreticky může smazat.

Proto: v **Nastavení → Data a záloha** si občas stáhni zálohu do souboru. Tam se
taky zapíná *trvalé úložiště*, které prohlížeči řekne, ať data nevyhazuje.

Nahraná hudba se do zálohy nedává (byly by to stovky MB) — MP3 si drž i jinde.

## Připojené služby

Appka si vystačí sama, ale některé moduly umí víc, když jim dáš přístup.
**Nic z toho není v gitu** — klíče se zadávají v Nastavení a zůstávají v telefonu.

| Služba | Na co | Co je potřeba |
|---|---|---|
| Transitous | spoje vlaků a autobusů po celé ČR | **nic**, funguje rovnou |
| Open-Meteo | počasí | **nic**, funguje rovnou |
| Spotify | vlastní playlisty, vyhledávání, ovládání přehrávání | Client ID + Premium |
| YouTube | vlastní playlisty a odběry | Google Client ID |
| TMDB | filmy a seriály, kde zrovna běží | free API klíč |

Postup nastavení je popsaný krok za krokem přímo v appce u každé služby.

### Spotify

Appka používá **Authorization Code s PKCE**, takže client secret neexistuje
a nic se neposílá přes žádný server. Na developer.spotify.com si založíš
aplikaci, do *Redirect URIs* vložíš adresu, kterou ti appka ukáže
(v produkci `https://…github.io/All-round-app/`, při vývoji
`http://127.0.0.1:5173/` — Spotify od února 2025 `localhost` nebere),
zaškrtneš Web API i Web Playback SDK a zkopíruješ Client ID.

Co pak funguje:

- **všude včetně telefonu**: vlastní playlisty, oblíbené skladby, vyhledávání
  v celém katalogu a **ovládání přehrávání přes Spotify Connect** — z appky
  pustíš hudbu do oficiální Spotify aplikace v tom samém telefonu nebo do
  jiného zařízení,
- **na počítači navíc**: appka se sama stane přehrávacím zařízením a hudba
  hraje přímo v ní. Na mobilních prohlížečích tohle Spotify nepodporuje,
  proto tam zůstává režim dálkového ovládání.

Ovládání přehrávání vyžaduje **Spotify Premium**.

### YouTube

Bez jakéhokoli nastavování funguje vkládání odkazů — nalepíš odkaz na video
nebo playlist a hraje ve vloženém přehrávači. Pro **vlastní playlisty,
odběry a vyhledávání** si v Google Cloud založíš projekt, zapneš YouTube
Data API v3 a vytvoříš OAuth Client ID; appka pak používá Google Identity
Services, kde taky žádný client secret není potřeba, jen povolený
JavaScript origin.

Přehrávání jde vždy přes oficiální přehrávač YouTube — vlastní audio-only
přehrávač ani stahování jejich podmínky nedovolují.

## Co appka umí a co ne

- **Spoje**: vyhledávání spojení, odjezdové tabule oblíbených zastávek, uložené
  trasy a spočítání, kdy vyjet, abys dorazil na šichtu. Data z Transitous
  (celostátní vlaky a autobusy, PID Praha včetně zpoždění, IDS JMK a další).
- **Šichty**: typy směn, opakující se rotace, měsíční kalendář a spočítání
  odpracovaných hodin i hrubé mzdy včetně příplatků za noční, víkendy, svátky
  a přesčasy podle zákoníku práce. Čistá mzda je jen orientační odhad.
- **Filmy**: Netflix ani jiné streamovací služby se do vlastní appky napojit
  nedají — Netflix zrušil veřejné API v roce 2014 a obsah je zamčený DRM. Appka
  proto umí watchlist, u každého titulu ukáže, na které službě v ČR běží, a
  jedním klepnutím ho otevře přímo v Netflixu.
- **Připomínky** fungují, když je appka otevřená. Nenahrazují systémový budík —
  na to si událost vyexportuj do kalendáře (`.ics`).
