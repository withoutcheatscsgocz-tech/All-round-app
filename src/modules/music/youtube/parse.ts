export interface YouTubeRef {
  kind: 'video' | 'playlist';
  id: string;
  /** U videa z playlistu si necháme obojí, ať jde přehrát celý seznam. */
  playlistId?: string;
}

/**
 * Z odkazu vytáhne ID videa nebo playlistu. Pokrývá běžné tvary:
 * watch?v=, youtu.be/, shorts/, embed/, playlist?list= i music.youtube.com.
 */
export function parseYouTubeUrl(input: string): YouTubeRef | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Samotné ID videa (11 znaků) nebo playlistu (začíná PL, UU, LL, RD…).
  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return { kind: 'video', id: trimmed };
  if (/^(PL|UU|LL|RD|OL|FL)[A-Za-z0-9_-]{10,}$/.test(trimmed)) {
    return { kind: 'playlist', id: trimmed };
  }

  let url: URL;
  try {
    url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '');
  const allowed = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be'];
  if (!allowed.includes(host)) return null;

  const list = url.searchParams.get('list') ?? undefined;

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1);
    return id ? { kind: 'video', id, playlistId: list } : null;
  }

  const video = url.searchParams.get('v');
  if (video) return { kind: 'video', id: video, playlistId: list };

  const path = /^\/(shorts|embed|live)\/([A-Za-z0-9_-]+)/.exec(url.pathname);
  if (path) return { kind: 'video', id: path[2], playlistId: list };

  if (list) return { kind: 'playlist', id: list };

  return null;
}

const EMBED_BASE = 'https://www.youtube-nocookie.com/embed';

/** Adresa pro vložený přehrávač. Přehrávat se musí přes něj — YouTube to jinak nedovoluje. */
export function embedUrl(ref: YouTubeRef, autoplay = false): string {
  const url =
    ref.kind === 'playlist'
      ? new URL(`${EMBED_BASE}/videoseries`)
      : new URL(`${EMBED_BASE}/${ref.id}`);

  if (ref.kind === 'playlist') url.searchParams.set('list', ref.id);
  else if (ref.playlistId) url.searchParams.set('list', ref.playlistId);

  if (autoplay) url.searchParams.set('autoplay', '1');
  url.searchParams.set('rel', '0');
  url.searchParams.set('playsinline', '1');
  return url.toString();
}

export function thumbnailUrl(ref: YouTubeRef): string | undefined {
  if (ref.kind !== 'video') return undefined;
  return `https://i.ytimg.com/vi/${ref.id}/mqdefault.jpg`;
}
