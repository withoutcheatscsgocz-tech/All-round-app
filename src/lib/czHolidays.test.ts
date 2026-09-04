import { describe, expect, it } from 'vitest';
import { czechHolidays, easterSunday, holidayName, isCzechHoliday } from './czHolidays';
import { toIsoDate } from './date';

describe('easterSunday', () => {
  it('sedí na známé roky', () => {
    expect(toIsoDate(easterSunday(2024))).toBe('2024-03-31');
    expect(toIsoDate(easterSunday(2025))).toBe('2025-04-20');
    expect(toIsoDate(easterSunday(2026))).toBe('2026-04-05');
    expect(toIsoDate(easterSunday(2027))).toBe('2027-03-28');
  });
});

describe('czechHolidays', () => {
  it('má 13 svátků ročně', () => {
    expect(czechHolidays(2026).size).toBe(13);
    expect(czechHolidays(2025).size).toBe(13);
  });

  it('zná pevné svátky', () => {
    expect(isCzechHoliday('2026-01-01')).toBe(true);
    expect(isCzechHoliday('2026-05-01')).toBe(true);
    expect(isCzechHoliday('2026-07-05')).toBe(true);
    expect(isCzechHoliday('2026-10-28')).toBe(true);
    expect(isCzechHoliday('2026-12-24')).toBe(true);
  });

  it('zná pohyblivé velikonoční svátky', () => {
    expect(isCzechHoliday('2026-04-03')).toBe(true); // Velký pátek
    expect(isCzechHoliday('2026-04-06')).toBe(true); // Velikonoční pondělí
    expect(isCzechHoliday('2026-04-05')).toBe(false); // neděle sama svátek není
  });

  it('běžný den svátek není', () => {
    expect(isCzechHoliday('2026-09-07')).toBe(false);
  });

  it('vrátí název česky i anglicky', () => {
    expect(holidayName('2026-05-01', 'cs')).toBe('Svátek práce');
    expect(holidayName('2026-05-01', 'en')).toBe('Labour Day');
    expect(holidayName('2026-09-07')).toBeUndefined();
  });
});
