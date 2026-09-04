import { getAccessToken } from './auth';

const API = 'https://api.spotify.com/v1';

export class SpotifyError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function call<T>(
  path: string,
  init: RequestInit = {},
  expectJson = true,
): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new SpotifyError('not-logged-in', 401);

  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (res.status === 204) return undefined as T;
  if (res.status === 401) throw new SpotifyError('not-logged-in', 401);
  if (res.status === 403) throw new SpotifyError('forbidden', 403);
  if (res.status === 404) throw new SpotifyError('no-active-device', 404);
  if (res.status === 429) throw new SpotifyError('rate-limited', 429);
  if (!res.ok) throw new SpotifyError(`HTTP ${res.status}`, res.status);

  return expectJson ? ((await res.json()) as T) : (undefined as T);
}

/* ------------------------------- typy -------------------------------- */

export interface SpotifyImage { url: string; width?: number; height?: number }

export interface SpotifyUser {
  id: string;
  display_name?: string;
  product?: 'premium' | 'free' | 'open';
  images?: SpotifyImage[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  uri: string;
  images: SpotifyImage[];
  tracks: { total: number };
  owner?: { display_name?: string };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images: SpotifyImage[] };
}

export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number | null;
}

export interface PlaybackState {
  is_playing: boolean;
  progress_ms: number | null;
  shuffle_state?: boolean;
  device?: SpotifyDevice;
  item?: SpotifyTrack | null;
}

/* ------------------------------ knihovna ----------------------------- */

export function me(): Promise<SpotifyUser> {
  return call('/me');
}

export async function myPlaylists(limit = 50): Promise<SpotifyPlaylist[]> {
  const data = await call<{ items: SpotifyPlaylist[] }>(`/me/playlists?limit=${limit}`);
  return data.items ?? [];
}

export async function playlistTracks(playlistId: string, limit = 100): Promise<SpotifyTrack[]> {
  const data = await call<{ items: { track: SpotifyTrack | null }[] }>(
    `/playlists/${playlistId}/tracks?limit=${limit}`,
  );
  // Odstraněné skladby přijdou jako null a lokální soubory nemají uri.
  return (data.items ?? []).map((i) => i.track).filter((t): t is SpotifyTrack => Boolean(t?.uri));
}

export async function savedTracks(limit = 50): Promise<SpotifyTrack[]> {
  const data = await call<{ items: { track: SpotifyTrack }[] }>(`/me/tracks?limit=${limit}`);
  return (data.items ?? []).map((i) => i.track);
}

export async function search(query: string, limit = 20): Promise<{
  tracks: SpotifyTrack[];
  playlists: SpotifyPlaylist[];
}> {
  if (!query.trim()) return { tracks: [], playlists: [] };
  const data = await call<{
    tracks?: { items: SpotifyTrack[] };
    playlists?: { items: (SpotifyPlaylist | null)[] };
  }>(`/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=${limit}`);
  return {
    tracks: data.tracks?.items ?? [],
    playlists: (data.playlists?.items ?? []).filter((p): p is SpotifyPlaylist => Boolean(p)),
  };
}

/* ----------------------------- přehrávání ---------------------------- */

export function playbackState(): Promise<PlaybackState | undefined> {
  return call<PlaybackState | undefined>('/me/player');
}

export async function devices(): Promise<SpotifyDevice[]> {
  const data = await call<{ devices: SpotifyDevice[] }>('/me/player/devices');
  return data.devices ?? [];
}

interface PlayOptions {
  deviceId?: string;
  /** Playlist nebo album — přehraje se celé. */
  contextUri?: string;
  /** Konkrétní skladby. */
  uris?: string[];
  offsetPosition?: number;
}

export function play(options: PlayOptions = {}): Promise<void> {
  const query = options.deviceId ? `?device_id=${options.deviceId}` : '';
  const body: Record<string, unknown> = {};
  if (options.contextUri) body.context_uri = options.contextUri;
  if (options.uris) body.uris = options.uris;
  if (options.offsetPosition !== undefined) body.offset = { position: options.offsetPosition };

  return call(`/me/player/play${query}`, {
    method: 'PUT',
    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
  }, false);
}

export function pause(): Promise<void> {
  return call('/me/player/pause', { method: 'PUT' }, false);
}

export function nextTrack(): Promise<void> {
  return call('/me/player/next', { method: 'POST' }, false);
}

export function previousTrack(): Promise<void> {
  return call('/me/player/previous', { method: 'POST' }, false);
}

export function setShuffle(on: boolean): Promise<void> {
  return call(`/me/player/shuffle?state=${on}`, { method: 'PUT' }, false);
}

export function setVolume(percent: number): Promise<void> {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return call(`/me/player/volume?volume_percent=${clamped}`, { method: 'PUT' }, false);
}

/** Přepne přehrávání na jiné zařízení (Spotify Connect). */
export function transferPlayback(deviceId: string, startPlaying = true): Promise<void> {
  return call('/me/player', {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play: startPlaying }),
  }, false);
}

/* ------------------------------ pomocné ------------------------------ */

export function artistNames(track: SpotifyTrack): string {
  return track.artists.map((a) => a.name).join(', ');
}

export function smallestImage(images: SpotifyImage[] | undefined): string | undefined {
  if (!images?.length) return undefined;
  return [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0]?.url;
}

/** Z odkazu nebo URI vytáhne typ a ID — uživatel může vložit obojí. */
export function parseSpotifyRef(input: string): { type: string; id: string } | null {
  const trimmed = input.trim();
  const uri = /^spotify:([a-z]+):([A-Za-z0-9]+)$/.exec(trimmed);
  if (uri) return { type: uri[1], id: uri[2] };

  const url = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?([a-z]+)\/([A-Za-z0-9]+)/.exec(trimmed);
  if (url) return { type: url[1], id: url[2] };

  return null;
}
