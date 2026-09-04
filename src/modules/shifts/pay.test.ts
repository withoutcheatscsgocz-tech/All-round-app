import { describe, expect, it } from 'vitest';
import { DEFAULT_PAY_CONFIG, expandPattern, shiftHours, summariseMonth } from './pay';
import type { PayConfig, Shift, ShiftType } from '../../db/types';

const morning: ShiftType = {
  id: 1, code: 'R', name: 'Ranní', start: '06:00', end: '14:00',
  breakMinutes: 30, paidBreak: false, color: '#f00',
};
const night: ShiftType = {
  id: 2, code: 'N', name: 'Noční', start: '22:00', end: '06:00',
  breakMinutes: 30, paidBreak: false, color: '#00f',
};
const twelve: ShiftType = {
  id: 3, code: 'D12', name: 'Denní 12h', start: '06:00', end: '18:00',
  breakMinutes: 60, paidBreak: false, color: '#0f0',
};

const types = new Map<number, ShiftType>([[1, morning], [2, night], [3, twelve]]);

// 2026-09-07 je pondělí, 2026-09-12 sobota, 2026-09-13 neděle.
const work = (date: string, typeId: number): Shift => ({ date, kind: 'work', typeId });

describe('shiftHours', () => {
  it('spočítá běžnou ranní šichtu a odečte neplacenou pauzu', () => {
    const h = shiftHours(work('2026-09-07', 1), morning);
    expect(h.rawMinutes).toBe(480);
    expect(h.workedMinutes).toBe(450);
    expect(h.nightMinutes).toBe(0);
    expect(h.weekendMinutes).toBe(0);
  });

  it('placená pauza se neodečítá', () => {
    const h = shiftHours(work('2026-09-07', 1), { ...morning, paidBreak: true });
    expect(h.workedMinutes).toBe(480);
    expect(h.breakMinutes).toBe(0);
  });

  it('noční šichta přes půlnoc je celá v nočních hodinách', () => {
    const h = shiftHours(work('2026-09-07', 2), night);
    expect(h.rawMinutes).toBe(480);
    // 22:00–24:00 (120) + 00:00–06:00 (360) = 480, ale zastropeno odpracovanými 450.
    expect(h.nightMinutes).toBe(450);
  });

  it('dvanáctka od šesti ráno nezasahuje do noci', () => {
    const h = shiftHours(work('2026-09-07', 3), twelve);
    expect(h.rawMinutes).toBe(720);
    expect(h.workedMinutes).toBe(660);
    expect(h.nightMinutes).toBe(0);
  });

  it('započítá jen tu část, která opravdu padne do noci', () => {
    const evening: ShiftType = { ...morning, start: '18:00', end: '23:00', breakMinutes: 0 };
    const h = shiftHours({ date: '2026-09-07', kind: 'work', typeId: 1 }, evening);
    expect(h.rawMinutes).toBe(300);
    expect(h.nightMinutes).toBe(60); // jen 22:00–23:00
  });

  it('víkendové hodiny se počítají za sobotu i neděli', () => {
    expect(shiftHours(work('2026-09-12', 1), morning).weekendMinutes).toBe(450);
    expect(shiftHours(work('2026-09-13', 1), morning).weekendMinutes).toBe(450);
    expect(shiftHours(work('2026-09-11', 1), morning).weekendMinutes).toBe(0);
  });

  it('šichta z pátku do soboty rozdělí víkendovou část správně', () => {
    // Pátek 2026-09-11 22:00 → sobota 06:00: víkend je jen 00:00–06:00.
    const h = shiftHours(work('2026-09-11', 2), night);
    expect(h.weekendMinutes).toBe(360);
    expect(h.nightMinutes).toBe(450);
  });

  it('sváteční hodiny pozná podle českého kalendáře', () => {
    // 28. 9. 2026 je Den české státnosti (pondělí).
    const h = shiftHours(work('2026-09-28', 1), morning);
    expect(h.holidayMinutes).toBe(450);
    expect(h.weekendMinutes).toBe(0);
  });

  it('volno a dovolená nedělají žádné hodiny', () => {
    expect(shiftHours({ date: '2026-09-07', kind: 'off' }).workedMinutes).toBe(0);
    expect(shiftHours({ date: '2026-09-07', kind: 'vacation' }).workedMinutes).toBe(0);
  });

  it('vlastní časy přebijí šablonu', () => {
    const h = shiftHours(
      { date: '2026-09-07', kind: 'work', typeId: 1, startOverride: '07:00', endOverride: '19:00', breakOverride: 0 },
      morning,
    );
    expect(h.rawMinutes).toBe(720);
    expect(h.workedMinutes).toBe(720);
  });
});

describe('summariseMonth', () => {
  const config: PayConfig = { ...DEFAULT_PAY_CONFIG, hourlyRate: 200, monthlyNormHours: 160 };

  it('sečte hodiny a spočítá hrubou mzdu s příplatky', () => {
    const shifts = [work('2026-09-07', 1), work('2026-09-08', 1), work('2026-09-12', 1)];
    const s = summariseMonth(shifts, types, config);

    expect(s.workDays).toBe(3);
    expect(s.workedHours).toBe(22.5);           // 3 × 7,5 h
    expect(s.weekendHours).toBe(7.5);           // jen sobota
    expect(s.overtimeHours).toBe(0);
    expect(s.pay.base).toBe(4500);              // 22,5 × 200
    expect(s.pay.weekend).toBe(150);            // 7,5 × 200 × 10 %
    expect(s.pay.gross).toBe(4650);
  });

  it('přesčas se počítá z hodin nad měsíčním fondem', () => {
    const shifts = Array.from({ length: 22 }, (_, i) =>
      work(`2026-09-${String(i + 1).padStart(2, '0')}`, 3),
    );
    const s = summariseMonth(shifts, types, { ...config, monthlyNormHours: 160 });
    expect(s.workedHours).toBe(242); // 22 × 11 h
    expect(s.overtimeHours).toBe(82);
    expect(s.pay.overtime).toBe(82 * 200 * 0.25);
  });

  it('spočítá i dny dovolené a nemoci zvlášť', () => {
    const s = summariseMonth(
      [
        work('2026-09-07', 1),
        { date: '2026-09-08', kind: 'vacation' },
        { date: '2026-09-09', kind: 'sick' },
        { date: '2026-09-10', kind: 'off' },
      ],
      types,
      config,
    );
    expect(s.workDays).toBe(1);
    expect(s.vacationDays).toBe(1);
    expect(s.sickDays).toBe(1);
    expect(s.offDays).toBe(1);
  });

  it('odhad čisté mzdy odečte pojistné a daň po slevě', () => {
    const s = summariseMonth([work('2026-09-07', 1)], types, {
      ...config,
      netEstimate: { enabled: true, taxPct: 15, socialPct: 7.1, healthPct: 4.5, taxCreditMonthly: 2570 },
    });
    // Hrubá 1500 → daň po slevě 0, pojistné 7,1 % + 4,5 %.
    expect(s.pay.gross).toBe(1500);
    expect(s.pay.deductions?.tax).toBe(0);
    expect(s.pay.net).toBe(1326);
  });
});

describe('expandPattern', () => {
  it('zopakuje cyklus krátký/dlouhý týden od kotevního data', () => {
    const out = expandPattern([1, 1, 'off'], '2026-09-07', '2026-09-07', 6);
    expect(out.map((s) => s.kind)).toEqual(['work', 'work', 'off', 'work', 'work', 'off']);
    expect(out[0].typeId).toBe(1);
    expect(out[2].typeId).toBeUndefined();
  });

  it('funguje i když generuju až od data před kotvou', () => {
    const out = expandPattern([1, 'off'], '2026-09-07', '2026-09-05', 4);
    expect(out.map((s) => s.date)).toEqual(['2026-09-05', '2026-09-06', '2026-09-07', '2026-09-08']);
    // 2026-09-07 je kotva → první prvek cyklu.
    expect(out[2].kind).toBe('work');
    expect(out[3].kind).toBe('off');
  });

  it('prázdný cyklus nic nevygeneruje', () => {
    expect(expandPattern([], '2026-09-07', '2026-09-07', 5)).toEqual([]);
  });
});
