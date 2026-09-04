import { describe, expect, it } from 'vitest';
import { describeWeather, needsUmbrella, weatherIcon, weatherLabel } from './codes';

describe('WMO kódy počasí', () => {
  it('přeloží běžné kódy česky i anglicky', () => {
    expect(weatherLabel(0)).toBe('Jasno');
    expect(weatherLabel(0, 'en')).toBe('Clear sky');
    expect(weatherLabel(3)).toBe('Zataženo');
    expect(weatherLabel(95)).toBe('Bouřka');
  });

  it('neznámý kód nespadne, jen řekne, že ho nezná', () => {
    expect(describeWeather(1234)).toEqual({ icon: '🌡️', cs: 'Neznámé počasí', en: 'Unknown' });
  });

  it('má ikonu pro každý kód, který Open-Meteo posílá', () => {
    const known = [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67,
                   71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99];
    for (const code of known) {
      expect(weatherIcon(code), `kód ${code}`).not.toBe('🌡️');
      expect(weatherLabel(code)).not.toBe('Neznámé počasí');
    }
  });

  it('deštník doporučí u deště, ne u sněhu ani u jasna', () => {
    expect(needsUmbrella(0)).toBe(false);
    expect(needsUmbrella(3)).toBe(false);
    expect(needsUmbrella(61)).toBe(true);
    expect(needsUmbrella(82)).toBe(true);
    expect(needsUmbrella(95)).toBe(true);
    expect(needsUmbrella(73)).toBe(false);
    expect(needsUmbrella(86)).toBe(false);
  });
});
