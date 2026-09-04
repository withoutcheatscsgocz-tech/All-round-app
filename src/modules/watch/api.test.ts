import { afterEach, describe, expect, it, vi } from 'vitest';
import { logoUrl, posterUrl, providerDeepLink, searchMulti, watchProviders } from './api';
import { db } from '../../db/db';

function mockFetch(payload: unknown, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status < 400, status, json: async () => payload,
  }));
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await db.settings.clear();
});

async function withKey() {
  await db.settings.put({ key: 'tmdb.apiKey', value: 'testovaci-klic' });
}

describe('searchMulti', () => {
  it('převede film i seriál a vyhodí lidi', async () => {
    await withKey();
    mockFetch({
      results: [
        {
          id: 603, media_type: 'movie', title: 'Matrix',
          release_date: '1999-03-30', poster_path: '/p.jpg',
          overview: 'Neo…', vote_average: 8.223,
        },
        {
          id: 1396, media_type: 'tv', name: 'Perníkový táta',
          first_air_date: '2008-01-20', vote_average: 8.9,
        },
        { id: 5, media_type: 'person', name: 'Keanu Reeves' },
      ],
    });

    const hits = await searchMulti('matrix');
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ kind: 'movie', tmdbId: 603, title: 'Matrix', year: 1999, rating: 8.2 });
    expect(hits[1]).toMatchObject({ kind: 'tv', title: 'Perníkový táta', year: 2008 });
  });

  it('krátký dotaz se vůbec neposílá', async () => {
    await withKey();
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    expect(await searchMulti('m')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });

  it('bez klíče to řekne rovnou', async () => {
    mockFetch({});
    await expect(searchMulti('matrix')).rejects.toThrow('missing-key');
  });

  it('špatný klíč pozná podle 401', async () => {
    await withKey();
    mockFetch({ status_message: 'Invalid API key' }, 401);
    await expect(searchMulti('matrix')).rejects.toThrow('bad-key');
  });
});

describe('watchProviders', () => {
  it('vytáhne české poskytovatele a seřadí je podle priority', async () => {
    await withKey();
    mockFetch({
      id: 603,
      results: {
        CZ: {
          link: 'https://www.themoviedb.org/movie/603/watch?locale=CZ',
          flatrate: [
            { provider_id: 8, provider_name: 'Netflix', logo_path: '/n.jpg', display_priority: 5 },
            { provider_id: 337, provider_name: 'Disney Plus', display_priority: 2 },
          ],
          rent: [{ provider_id: 3, provider_name: 'Google Play Movies', display_priority: 1 }],
        },
        US: { flatrate: [{ provider_id: 15, provider_name: 'Hulu' }] },
      },
    });

    const info = await watchProviders('movie', 603);
    expect(info.link).toContain('locale=CZ');
    expect(info.providers.map((p) => p.name)).toEqual(['Disney Plus', 'Netflix', 'Google Play Movies']);
    expect(info.providers[0].offer).toBe('flatrate');
    expect(info.providers[2].offer).toBe('rent');
    // Poskytovatelé z jiných zemí se do výsledku nedostanou.
    expect(info.providers.some((p) => p.name === 'Hulu')).toBe(false);
  });

  it('titul, který v ČR nikde neběží, vrátí prázdný seznam', async () => {
    await withKey();
    mockFetch({ id: 1, results: { US: { flatrate: [] } } });
    expect((await watchProviders('movie', 1)).providers).toEqual([]);
  });
});

describe('providerDeepLink', () => {
  it('u známých služeb otevře jejich vyhledávání', () => {
    expect(providerDeepLink('Netflix', 'Matrix')).toBe('https://www.netflix.com/search?q=Matrix');
    expect(providerDeepLink('Disney Plus', 'Loki')).toContain('disneyplus.com/search');
    expect(providerDeepLink('Amazon Prime Video', 'Fallout')).toContain('primevideo.com/search');
    expect(providerDeepLink('HBO Max', 'Přátelé')).toContain('play.max.com');
  });

  it('název s diakritikou a mezerami správně zakóduje', () => {
    expect(providerDeepLink('Netflix', 'Přátelé z lesa')).toBe(
      'https://www.netflix.com/search?q=P%C5%99%C3%A1tel%C3%A9%20z%20lesa',
    );
  });

  it('u neznámé služby vrátí null a použije se odkaz z TMDB', () => {
    expect(providerDeepLink('Nějaká Televize', 'X')).toBeNull();
  });
});

describe('obrázky', () => {
  it('poskládá adresu plakátu i loga', () => {
    expect(posterUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg');
    expect(posterUrl('/abc.jpg', 'w154')).toContain('/w154/');
    expect(logoUrl('/l.jpg')).toContain('/w92/');
    expect(posterUrl(null)).toBeUndefined();
  });
});
