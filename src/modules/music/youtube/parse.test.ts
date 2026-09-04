import { describe, expect, it } from 'vitest';
import { embedUrl, parseYouTubeUrl, thumbnailUrl } from './parse';

describe('parseYouTubeUrl', () => {
  it('rozumí běžnému odkazu na video', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      kind: 'video', id: 'dQw4w9WgXcQ', playlistId: undefined,
    });
  });

  it('rozumí zkrácenému odkazu, shorts i embed', () => {
    expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeUrl('https://www.youtube.com/shorts/abc12345678')?.id).toBe('abc12345678');
    expect(parseYouTubeUrl('https://www.youtube.com/embed/abc12345678')?.id).toBe('abc12345678');
  });

  it('u videa z playlistu si nechá obojí', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabcdefghij')).toEqual({
      kind: 'video', id: 'dQw4w9WgXcQ', playlistId: 'PLabcdefghij',
    });
  });

  it('rozumí samotnému playlistu i YouTube Music', () => {
    expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=PLabcdefghij')).toEqual({
      kind: 'playlist', id: 'PLabcdefghij',
    });
    expect(parseYouTubeUrl('https://music.youtube.com/watch?v=dQw4w9WgXcQ')?.id).toBe('dQw4w9WgXcQ');
  });

  it('vezme i holé ID', () => {
    expect(parseYouTubeUrl('dQw4w9WgXcQ')).toEqual({ kind: 'video', id: 'dQw4w9WgXcQ' });
    expect(parseYouTubeUrl('PLabcdefghijkl')).toEqual({ kind: 'playlist', id: 'PLabcdefghijkl' });
  });

  it('cizí ani rozbitý odkaz nepustí dál', () => {
    expect(parseYouTubeUrl('https://vimeo.com/12345')).toBeNull();
    expect(parseYouTubeUrl('https://www.youtube.com/')).toBeNull();
    expect(parseYouTubeUrl('nesmysl')).toBeNull();
    expect(parseYouTubeUrl('')).toBeNull();
  });
});

describe('embedUrl', () => {
  it('video se přehrává přes youtube-nocookie', () => {
    const url = embedUrl({ kind: 'video', id: 'dQw4w9WgXcQ' });
    expect(url).toContain('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(url).toContain('playsinline=1');
  });

  it('playlist použije videoseries', () => {
    const url = embedUrl({ kind: 'playlist', id: 'PLabc' }, true);
    expect(url).toContain('/embed/videoseries');
    expect(url).toContain('list=PLabc');
    expect(url).toContain('autoplay=1');
  });

  it('video z playlistu si playlist ponese s sebou', () => {
    expect(embedUrl({ kind: 'video', id: 'v1', playlistId: 'PLx' })).toContain('list=PLx');
  });
});

describe('thumbnailUrl', () => {
  it('náhled má jen video', () => {
    expect(thumbnailUrl({ kind: 'video', id: 'abc' })).toContain('/vi/abc/');
    expect(thumbnailUrl({ kind: 'playlist', id: 'PL' })).toBeUndefined();
  });
});
