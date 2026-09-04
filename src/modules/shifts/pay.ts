import type { IsoDate, PayConfig, Shift, ShiftType } from '../../db/types';
import { addDays, dateTime, fromIsoDate, isWeekend, round2, toIsoDate } from '../../lib/date';
import { isCzechHoliday } from '../../lib/czHolidays';

/** Noční práce podle § 78 zákoníku práce: 22:00–06:00. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 6;

export const DEFAULT_PAY_CONFIG: PayConfig = {
  hourlyRate: 200,
  currency: 'CZK',
  // Zákonná minima: § 116 noční, § 118 víkend, § 115 svátek, § 114 přesčas.
  nightPct: 10,
  weekendPct: 10,
  holidayPct: 100,
  overtimePct: 25,
  monthlyNormHours: 160,
  netEstimate: {
    enabled: false,
    taxPct: 15,
    socialPct: 7.1,
    healthPct: 4.5,
    taxCreditMonthly: 2570,
  },
};

export interface ShiftInterval {
  start: Date;
  end: Date;
}

/**
 * Skutečný začátek a konec šichty. Když je konec dřív než začátek,
 * šichta přechází přes půlnoc do dalšího dne.
 */
export function shiftInterval(shift: Shift, type?: ShiftType): ShiftInterval | null {
  if (shift.kind !== 'work') return null;
  const start = shift.startOverride ?? type?.start;
  const end = shift.endOverride ?? type?.end;
  if (!start || !end) return null;

  const startAt = dateTime(shift.date, start);
  let endAt = dateTime(shift.date, end);
  if (endAt <= startAt) endAt = dateTime(addDays(shift.date, 1), end);
  return { start: startAt, end: endAt };
}

function overlapMinutes(a: ShiftInterval, bStart: Date, bEnd: Date): number {
  const start = Math.max(a.start.getTime(), bStart.getTime());
  const end = Math.min(a.end.getTime(), bEnd.getTime());
  return Math.max(0, (end - start) / 60_000);
}

/** Kalendářní dny, kterých se šichta dotkne (kvůli šichtám přes půlnoc). */
function touchedDays(interval: ShiftInterval): IsoDate[] {
  const days: IsoDate[] = [];
  let day = toIsoDate(interval.start);
  const last = toIsoDate(new Date(interval.end.getTime() - 1));
  for (let guard = 0; guard < 4; guard += 1) {
    days.push(day);
    if (day === last) break;
    day = addDays(day, 1);
  }
  return days;
}

export interface ShiftHours {
  /** Délka šichty bez odečtení pauzy. */
  rawMinutes: number;
  breakMinutes: number;
  /** Odpracované minuty, ze kterých se počítá mzda. */
  workedMinutes: number;
  nightMinutes: number;
  weekendMinutes: number;
  holidayMinutes: number;
}

const EMPTY_HOURS: ShiftHours = {
  rawMinutes: 0, breakMinutes: 0, workedMinutes: 0,
  nightMinutes: 0, weekendMinutes: 0, holidayMinutes: 0,
};

/**
 * Rozpad jedné šichty na hodiny podle příplatků.
 *
 * Pauza se odečítá z celkových odpracovaných minut. Příplatkové hodiny se
 * počítají z celého intervalu (nevíme, kdy přesně si člověk pauzu vybral),
 * ale nikdy nepřesáhnou odpracované minuty.
 */
export function shiftHours(shift: Shift, type?: ShiftType): ShiftHours {
  const interval = shiftInterval(shift, type);
  if (!interval) return EMPTY_HOURS;

  const rawMinutes = (interval.end.getTime() - interval.start.getTime()) / 60_000;
  const paidBreak = type?.paidBreak ?? false;
  const breakMinutes = shift.breakOverride ?? type?.breakMinutes ?? 0;
  const workedMinutes = Math.max(0, rawMinutes - (paidBreak ? 0 : breakMinutes));

  let nightMinutes = 0;
  let weekendMinutes = 0;
  let holidayMinutes = 0;

  for (const day of touchedDays(interval)) {
    const dayStart = fromIsoDate(day);
    const nextDay = fromIsoDate(addDays(day, 1));

    // Noc se v rámci dne skládá ze dvou kusů: 00:00–06:00 a 22:00–24:00.
    nightMinutes += overlapMinutes(interval, dayStart, dateTime(day, `0${NIGHT_END_HOUR}:00`));
    nightMinutes += overlapMinutes(interval, dateTime(day, `${NIGHT_START_HOUR}:00`), nextDay);

    if (isWeekend(day)) weekendMinutes += overlapMinutes(interval, dayStart, nextDay);
    if (isCzechHoliday(day)) holidayMinutes += overlapMinutes(interval, dayStart, nextDay);
  }

  const cap = (n: number) => Math.min(n, workedMinutes);
  return {
    rawMinutes,
    breakMinutes: paidBreak ? 0 : breakMinutes,
    workedMinutes,
    nightMinutes: cap(nightMinutes),
    weekendMinutes: cap(weekendMinutes),
    holidayMinutes: cap(holidayMinutes),
  };
}

export interface MonthSummary {
  workedHours: number;
  nightHours: number;
  weekendHours: number;
  holidayHours: number;
  overtimeHours: number;
  breakHours: number;
  workDays: number;
  vacationDays: number;
  sickDays: number;
  offDays: number;
  pay: PayBreakdown;
}

export interface PayBreakdown {
  base: number;
  night: number;
  weekend: number;
  holiday: number;
  overtime: number;
  gross: number;
  /** Odhad čisté mzdy — jen když je v nastavení zapnutý. */
  net?: number;
  deductions?: { tax: number; social: number; health: number };
}

export function computePay(
  hours: Omit<MonthSummary, 'pay' | 'workDays' | 'vacationDays' | 'sickDays' | 'offDays' | 'breakHours'>,
  config: PayConfig,
): PayBreakdown {
  const rate = config.hourlyRate;
  const base = hours.workedHours * rate;
  const night = hours.nightHours * rate * (config.nightPct / 100);
  const weekend = hours.weekendHours * rate * (config.weekendPct / 100);
  const holiday = hours.holidayHours * rate * (config.holidayPct / 100);
  const overtime = hours.overtimeHours * rate * (config.overtimePct / 100);
  const gross = base + night + weekend + holiday + overtime;

  const breakdown: PayBreakdown = {
    base: round2(base),
    night: round2(night),
    weekend: round2(weekend),
    holiday: round2(holiday),
    overtime: round2(overtime),
    gross: round2(gross),
  };

  if (config.netEstimate.enabled) {
    const { taxPct, socialPct, healthPct, taxCreditMonthly } = config.netEstimate;
    const social = gross * (socialPct / 100);
    const health = gross * (healthPct / 100);
    const tax = Math.max(0, gross * (taxPct / 100) - taxCreditMonthly);
    breakdown.deductions = { tax: round2(tax), social: round2(social), health: round2(health) };
    breakdown.net = round2(Math.max(0, gross - social - health - tax));
  }

  return breakdown;
}

/** Součet za měsíc — hodiny podle příplatků, počty dní a rozpad mzdy. */
export function summariseMonth(
  shifts: Shift[],
  types: Map<number, ShiftType>,
  config: PayConfig,
): MonthSummary {
  let workedMin = 0, nightMin = 0, weekendMin = 0, holidayMin = 0, breakMin = 0;
  let workDays = 0, vacationDays = 0, sickDays = 0, offDays = 0;

  for (const shift of shifts) {
    switch (shift.kind) {
      case 'work': {
        const h = shiftHours(shift, shift.typeId ? types.get(shift.typeId) : undefined);
        if (h.workedMinutes > 0) workDays += 1;
        workedMin += h.workedMinutes;
        nightMin += h.nightMinutes;
        weekendMin += h.weekendMinutes;
        holidayMin += h.holidayMinutes;
        breakMin += h.breakMinutes;
        break;
      }
      case 'vacation': vacationDays += 1; break;
      case 'sick': sickDays += 1; break;
      case 'off': offDays += 1; break;
      default: break;
    }
  }

  const workedHours = round2(workedMin / 60);
  const overtimeHours = round2(Math.max(0, workedHours - config.monthlyNormHours));

  const hours = {
    workedHours,
    nightHours: round2(nightMin / 60),
    weekendHours: round2(weekendMin / 60),
    holidayHours: round2(holidayMin / 60),
    overtimeHours,
  };

  return {
    ...hours,
    breakHours: round2(breakMin / 60),
    workDays, vacationDays, sickDays, offDays,
    pay: computePay(hours, config),
  };
}

/**
 * Rozgeneruje rotaci šicht od kotevního data. Cyklus může být libovolně
 * dlouhý — pokryje krátký/dlouhý týden, 2-2-3 i dvanáctky.
 */
export function expandPattern(
  sequence: (number | 'off')[],
  anchorDate: IsoDate,
  fromDate: IsoDate,
  days: number,
): Shift[] {
  if (sequence.length === 0) return [];
  const anchor = fromIsoDate(anchorDate).getTime();
  const out: Shift[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = addDays(fromDate, i);
    const diffDays = Math.round((fromIsoDate(date).getTime() - anchor) / 86_400_000);
    const index = ((diffDays % sequence.length) + sequence.length) % sequence.length;
    const slot = sequence[index];
    out.push(
      slot === 'off'
        ? { date, kind: 'off' }
        : { date, kind: 'work', typeId: slot },
    );
  }
  return out;
}
