import { describe, expect, it } from 'vitest';
import { artistNames, parseSpotifyRef, smallestImage } from './api';
import type { SpotifyTrack } from './api';

describe('parseSpotifyRef', () => {
  it('rozumí URI i webovému odkazu', () => {
    expect(parseSpotifyRef('spotify:playlist:37i9dQZF1DXcBWIGoYBM5M')).toEqual({
      type: 'playlist', id: '37i9dQZF1DXcBWIGoYBM5M',
    });
    expect(parseSpotifyRef('https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3')).toEqual({
      type: 'album', id: '1DFixLWuPkv3KT3TnV35m3',
    });
  });

  it('zvládne odkaz s jazykovou předponou a parametry', () => {
    expect(parseSpotifyRef('https://open.spotify.com/intl-cs/track/4cOdK2wGLETKBW3PvgPWqT?si=abc')).toEqual({
      type: 'track', id: '4cOdK2wGLETKBW3PvgPWqT',
    });
  });

  it('nesmysl vrátí null', () => {
    expect(parseSpotifyRef('https://example.com/neco')).toBeNull();
    expect(parseSpotifyRef('')).toBeNull();
  });
});

describe('pomocné funkce', () => {
  it('spojí interprety čárkou', () => {
    const track = { artists: [{ name: 'Kabát' }, { name: 'Chinaski' }] } as SpotifyTrack;
    expect(artistNames(track)).toBe('Kabát, Chinaski');
  });

  it('vybere nejmenší obrázek, ať se na mobilu netahá zbytečně velký', () => {
    expect(smallestImage([
      { url: 'velky', width: 640 },
      { url: 'maly', width: 64 },
      { url: 'stredni', width: 300 },
    ])).toBe('maly');
    expect(smallestImage([])).toBeUndefined();
    expect(smallestImage(undefined)).toBeUndefined();
  });
});
