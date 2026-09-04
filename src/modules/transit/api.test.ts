import { describe, expect, it, vi, afterEach } from 'vitest';
import { delayMinutes, geocode, isTransitMode, legLabel, modeIcon, stopTimes } from './api';
import type { Leg } from './api';

function mockFetch(payload: unknown, ok = true) {
  const spy = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => payload,
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => vi.unstubAllGlobals());

describe('geocode', () => {
  it('vytáhne z odpovědi zastávku i s obcí a krajem', async () => {
    mockFetch([
      {
        id: 'cz-IDS-JMK_U1146N364',
        type: 'STOP',
        name: 'Hlavní nádraží',
        lat: 49.19,
        lon: 16.61,
        modes: ['TRAM', 'BUS'],
        areas: [
          { name: 'Česko', adminLevel: 2 },
          { name: 'Jihomoravský kraj', adminLevel: 4 },
          { name: 'Brno', adminLevel: 8, default: true },
        ],
      },
    ]);

    const [hit] = await geocode('Brno hlavní');
    expect(hit.name).toBe('Hlavní nádraží');
    expect(hit.stopId).toBe('cz-IDS-JMK_U1146N364');
    expect(hit.area).toBe('Brno · Jihomoravský kraj');
  });

  it('krátký dotaz neposílá vůbec', async () => {
    const spy = mockFetch([]);
    expect(await geocode('B')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('adresa bez zastávky nemá stopId', async () => {
    mockFetch([{ id: 'x', type: 'ADDRESS', name: 'Náměstí Svobody 1', lat: 49.1, lon: 16.6 }]);
    const [hit] = await geocode('Náměstí');
    expect(hit.stopId).toBeUndefined();
  });
});

describe('stopTimes', () => {
  it('převede odjezdy a pozná zpoždění i zrušený spoj', async () => {
    mockFetch({
      stopTimes: [
        {
          place: {
            name: 'Hlavní nádraží', lat: 49, lon: 16,
            departure: '2026-09-04T18:25:00Z',
            scheduledDeparture: '2026-09-04T18:22:00Z',
            track: '2',
          },
          mode: 'TRAM',
          realTime: true,
          headsign: 'Technologický park',
          routeShortName: '12',
          routeColor: '00ccff',
          tripCancelled: false,
        },
        {
          place: { name: 'Hlavní nádraží', lat: 49, lon: 16, departure: '2026-09-04T18:30:00Z' },
          mode: 'BUS',
          realTime: false,
          routeShortName: '76',
          tripCancelled: true,
        },
        // Bez odjezdu = konečná, do tabule nepatří.
        { place: { name: 'Hlavní nádraží', lat: 49, lon: 16 }, mode: 'BUS', realTime: false },
      ],
    });

    const departures = await stopTimes('cz-IDS-JMK_U1146N364');
    expect(departures).toHaveLength(2);
    expect(departures[0].line).toBe('12');
    expect(departures[0].track).toBe('2');
    expect(delayMinutes(departures[0].time, departures[0].scheduledTime)).toBe(3);
    expect(departures[1].cancelled).toBe(true);
  });

  it('chybu ze serveru vyhodí jako TransitError', async () => {
    mockFetch({ error: 'Could not find timetable location' });
    await expect(stopTimes('nesmysl')).rejects.toThrow(/Could not find/);
  });
});

describe('pomocné funkce', () => {
  it('pozná dopravní prostředek proti chůzi', () => {
    expect(isTransitMode('BUS')).toBe(true);
    expect(isTransitMode('WALK')).toBe(false);
    expect(isTransitMode('BIKE')).toBe(false);
  });

  it('má ikonu pro každý běžný prostředek i pro neznámý', () => {
    expect(modeIcon('TRAM')).toBe('🚊');
    expect(modeIcon('LONG_DISTANCE')).toBe('🚄');
    expect(modeIcon('OTHER')).toBe('🚏');
  });

  it('zpoždění bez jízdního řádu je nula', () => {
    expect(delayMinutes('2026-09-04T18:25:00Z')).toBe(0);
    expect(delayMinutes('2026-09-04T18:19:00Z', '2026-09-04T18:22:00Z')).toBe(-3);
  });

  it('popisek linky bere zkratku, jinak dlouhý název', () => {
    expect(legLabel({ routeShortName: 'RJ 1030', mode: 'RAIL' } as Leg)).toBe('RJ 1030');
    expect(legLabel({ routeLongName: 'RegioJet', mode: 'RAIL' } as Leg)).toBe('RegioJet');
    expect(legLabel({ mode: 'WALK' } as Leg)).toBe('WALK');
  });
});
