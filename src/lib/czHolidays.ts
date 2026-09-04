import type { IsoDate } from '../db/types';
import { toIsoDate } from './date';

/** Velikonoční neděle podle anonymního gregoriánského algoritmu (Meeus/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const FIXED: [month: number, day: number, cs: string, en: string][] = [
  [1, 1, 'Nový rok / Den obnovy samostatného českého státu', "New Year's Day"],
  [5, 1, 'Svátek práce', 'Labour Day'],
  [5, 8, 'Den vítězství', 'Victory Day'],
  [7, 5, 'Den slovanských věrozvěstů Cyrila a Metoděje', 'Saints Cyril and Methodius Day'],
  [7, 6, 'Den upálení mistra Jana Husa', 'Jan Hus Day'],
  [9, 28, 'Den české státnosti', 'Czech Statehood Day'],
  [10, 28, 'Den vzniku samostatného československého státu', 'Independent Czechoslovak State Day'],
  [11, 17, 'Den boje za svobodu a demokracii', 'Struggle for Freedom and Democracy Day'],
  [12, 24, 'Štědrý den', 'Christmas Eve'],
  [12, 25, '1. svátek vánoční', 'Christmas Day'],
  [12, 26, '2. svátek vánoční', "St. Stephen's Day"],
];

export interface Holiday {
  date: IsoDate;
  cs: string;
  en: string;
}

const cache = new Map<number, Map<IsoDate, Holiday>>();

/** Všechny státní svátky ČR v daném roce, klíčované datem. */
export function czechHolidays(year: number): Map<IsoDate, Holiday> {
  const hit = cache.get(year);
  if (hit) return hit;

  const map = new Map<IsoDate, Holiday>();
  for (const [month, day, cs, en] of FIXED) {
    const date = toIsoDate(new Date(year, month - 1, day));
    map.set(date, { date, cs, en });
  }

  const easter = easterSunday(year);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);

  map.set(toIsoDate(goodFriday), {
    date: toIsoDate(goodFriday), cs: 'Velký pátek', en: 'Good Friday',
  });
  map.set(toIsoDate(easterMonday), {
    date: toIsoDate(easterMonday), cs: 'Velikonoční pondělí', en: 'Easter Monday',
  });

  cache.set(year, map);
  return map;
}

export function isCzechHoliday(iso: IsoDate): boolean {
  return czechHolidays(Number(iso.slice(0, 4))).has(iso);
}

export function holidayName(iso: IsoDate, lang: 'cs' | 'en' = 'cs'): string | undefined {
  const h = czechHolidays(Number(iso.slice(0, 4))).get(iso);
  return h?.[lang];
}
