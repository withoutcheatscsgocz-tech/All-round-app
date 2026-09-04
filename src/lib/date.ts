import type { ClockTime, IsoDate } from '../db/types';

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** 'YYYY-MM-DD' v lokálním čase (ne UTC — proto ne toISOString). */
export function toIsoDate(d: Date): IsoDate {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = fromIsoDate(iso);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}

export function monthKey(iso: IsoDate): string {
  return iso.slice(0, 7);
}

/** Počet dní v měsíci pro klíč 'YYYY-MM'. */
export function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthDays(month: string): IsoDate[] {
  const n = daysInMonth(month);
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pondělí = 0 … neděle = 6 (české řazení týdne). */
export function weekdayIndex(iso: IsoDate): number {
  return (fromIsoDate(iso).getDay() + 6) % 7;
}

export function isWeekend(iso: IsoDate): boolean {
  return weekdayIndex(iso) >= 5;
}

/** 'HH:MM' → minuty od půlnoci. */
export function timeToMinutes(t: ClockTime): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): ClockTime {
  const norm = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(norm / 60)).padStart(2, '0')}:${String(norm % 60).padStart(2, '0')}`;
}

/** Spojí datum a čas do skutečného okamžiku v lokálním pásmu. */
export function dateTime(iso: IsoDate, time: ClockTime): Date {
  const d = fromIsoDate(iso);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Hodiny na 2 desetinná místa, ať se součty nerozjedou o zaokrouhlování. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatDuration(minutes: number, locale = 'cs'): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} min`;
  if (m === 0) return locale === 'cs' ? `${h} h` : `${h} h`;
  return `${h} h ${m} min`;
}
