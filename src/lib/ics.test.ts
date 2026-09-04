import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

describe('buildIcs', () => {
  it('vyrobí platnou kostru kalendáře', () => {
    const ics = buildIcs([
      {
        uid: 'a@all-round',
        title: 'Ranní',
        start: new Date(2026, 8, 7, 6, 0),
        end: new Date(2026, 8, 7, 14, 0),
      },
    ]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260907T060000');
    expect(ics).toContain('DTEND:20260907T140000');
    expect(ics).toContain('SUMMARY:Ranní');
    expect(ics.endsWith('END:VCALENDAR')).toBe(true);
    expect(ics).toContain('\r\n');
  });

  it('escapuje čárky, středníky a nové řádky', () => {
    const ics = buildIcs([
      { uid: 'b', title: 'Noční, dlouhá; šichta', description: 'první\ndruhý', start: '2026-09-07' },
    ]);
    expect(ics).toContain('SUMMARY:Noční\\, dlouhá\; šichta');
    expect(ics).toContain('DESCRIPTION:první\\ndruhý');
  });

  it('celodenní událost použije formát DATE', () => {
    const ics = buildIcs([{ uid: 'c', title: 'Dovolená', start: '2026-09-07', end: '2026-09-08' }]);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260907');
    expect(ics).toContain('DTEND;VALUE=DATE:20260908');
  });

  it('zalomí dlouhý řádek pod 75 oktetů', () => {
    const ics = buildIcs([{ uid: 'd', title: 'x'.repeat(200), start: '2026-09-07' }]);
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });
});
