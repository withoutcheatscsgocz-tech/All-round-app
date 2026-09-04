import { describe, expect, it } from 'vitest';
import {
  addDays, addMonths, daysInMonth, isWeekend, minutesToTime,
  monthDays, timeToMinutes, weekdayIndex,
} from './date';

describe('práce s datem', () => {
  it('přičítá dny přes konec měsíce i roku', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('zná délku měsíce včetně přestupného února', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2024-02')).toBe(29);
    expect(daysInMonth('2026-09')).toBe(30);
  });

  it('vygeneruje všechny dny měsíce', () => {
    const days = monthDays('2026-09');
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-09-01');
    expect(days[29]).toBe('2026-09-30');
  });

  it('posouvá měsíce přes přelom roku', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('počítá týden od pondělí', () => {
    expect(weekdayIndex('2026-09-07')).toBe(0); // pondělí
    expect(weekdayIndex('2026-09-13')).toBe(6); // neděle
    expect(isWeekend('2026-09-12')).toBe(true);
    expect(isWeekend('2026-09-11')).toBe(false);
  });

  it('převádí čas na minuty a zpátky', () => {
    expect(timeToMinutes('06:00')).toBe(360);
    expect(timeToMinutes('22:30')).toBe(1350);
    expect(minutesToTime(360)).toBe('06:00');
    expect(minutesToTime(1500)).toBe('01:00'); // přeteklo přes půlnoc
  });
});
