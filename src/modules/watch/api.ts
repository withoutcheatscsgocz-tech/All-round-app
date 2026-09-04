import { getSetting, setSetting, db } from '../../db/db';

/**
 * TMDB — filmy a seriály včetně informace, na které službě v Česku běží
 * (ta data pocházejí z JustWatch). Klíč zadává uživatel v appce a zůstává
 * jen v jeho zařízení.
 */
const API = 'https://api.themoviedb.org/3';
const IMAGES = 'https://image.tmdb.org/t/p';
const KEY_SETTING = 'tmdb.apiKey';

/** Poskytovatelé se hlásí pro region, ne globálně. */
export const REGION = 'CZ';

export class TmdbError extends Error {}

export function getApiKey(): Promise<string> {
  return getSetting(KEY_SETTING, '');
}

export async function setApiKey(key: string): Promise<void> {
  await setSetting(KEY_SETTING, key.trim());
}

export async function clearApiKey(): Promise<void> {
  await db.settings.delete(KEY_SETTING);
}

async function call<T>(path: string, params: Record<string, string> = {}, lang = 'cs-CZ'): Promise<T> {
  const key = await getApiKey();
  if (!key) throw new TmdbError('missing-key');

  const url = new URL(API + path);
  url.searchParams.set('api_key', key);
  url.searchParams.set('language', lang);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (res.status === 401) throw new TmdbError('bad-key');
  if (!res.ok) throw new TmdbError(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export function posterUrl(path: string | null | undefined, size: 'w154' | 'w342' | 'w500' = 'w342'): string | undefined {
  return path ? `${IMAGES}/${size}${path}` : undefined;
}

export function logoUrl(path: string | null | undefined): string | undefined {
  return path ? `${IMAGES}/w92${path}` : undefined;
}

/* ------------------------------ hledání ------------------------------ */

export interface SearchHit {
  kind: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  rating?: number;
}

interface RawSearchItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  overview?: string;
  vote_average?: number;
}

function toHit(raw: RawSearchItem, forcedKind?: 'movie' | 'tv'): SearchHit | null {
  const kind = forcedKind ?? (raw.media_type === 'movie' || raw.media_type === 'tv' ? raw.media_type : null);
  if (!kind) return null; // ve výsledcích jsou i lidé, ty nechceme

  const date = raw.release_date ?? raw.first_air_date;
  return {
    kind,
    tmdbId: raw.id,
    title: raw.title ?? raw.name ?? '',
    year: date ? Number(date.slice(0, 4)) || undefined : undefined,
    poster: raw.poster_path ?? undefined,
    overview: raw.overview?.trim() || undefined,
    rating: raw.vote_average ? Math.round(raw.vote_average * 10) / 10 : undefined,
  };
}

export async function searchMulti(query: string): Promise<SearchHit[]> {
  if (query.trim().length < 2) return [];
  const data = await call<{ results?: RawSearchItem[] }>('/search/multi', {
    query, include_adult: 'false', page: '1',
  });
  return (data.results ?? [])
    .map((raw) => toHit(raw))
    .filter((hit): hit is SearchHit => hit !== null && Boolean(hit.title));
}

export async function trending(): Promise<SearchHit[]> {
  const data = await call<{ results?: RawSearchItem[] }>('/trending/all/week');
  return (data.results ?? [])
    .map((raw) => toHit(raw))
    .filter((hit): hit is SearchHit => hit !== null && Boolean(hit.title));
}

/* -------------------------- kde to běží (CZ) ------------------------- */

export interface Provider {
  id: number;
  name: string;
  logo?: string;
  /** flatrate = v předplatném, jinak půjčovné nebo koupě. */
  offer: 'flatrate' | 'rent' | 'buy' | 'ads';
}

interface RawProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
  display_priority?: number;
}

export interface WatchInfo {
  providers: Provider[];
  /** Stránka TMDB/JustWatch se všemi možnostmi. */
  link?: string;
}

export async function watchProviders(kind: 'movie' | 'tv', id: number): Promise<WatchInfo> {
  const data = await call<{
    results?: Record<string, {
      link?: string;
      flatrate?: RawProvider[];
      rent?: RawProvider[];
      buy?: RawProvider[];
      ads?: RawProvider[];
    }>;
  }>(`/${kind}/${id}/watch/providers`);

  const region = data.results?.[REGION];
  if (!region) return { providers: [] };

  const collect = (list: RawProvider[] | undefined, offer: Provider['offer']): Provider[] =>
    (list ?? [])
      .sort((a, b) => (a.display_priority ?? 99) - (b.display_priority ?? 99))
      .map((p) => ({ id: p.provider_id, name: p.provider_name, logo: p.logo_path, offer }));

  return {
    link: region.link,
    providers: [
      ...collect(region.flatrate, 'flatrate'),
      ...collect(region.ads, 'ads'),
      ...collect(region.rent, 'rent'),
      ...collect(region.buy, 'buy'),
    ],
  };
}

/**
 * Odkaz, který na telefonu otevře rovnou appku dané služby. Netflix ani
 * ostatní nedávají přímé ID titulu, takže se otevře jejich vyhledávání —
 * je to o jedno klepnutí navíc, ale funguje to spolehlivě.
 */
export function providerDeepLink(providerName: string, title: string): string | null {
  const query = encodeURIComponent(title);
  const name = providerName.toLowerCase();

  if (name.includes('netflix')) return `https://www.netflix.com/search?q=${query}`;
  if (name.includes('disney')) return `https://www.disneyplus.com/search?q=${query}`;
  if (name.includes('amazon') || name.includes('prime video')) {
    return `https://www.primevideo.com/search/?phrase=${query}`;
  }
  if (name.includes('max') || name.includes('hbo')) return `https://play.max.com/search?q=${query}`;
  if (name.includes('apple')) return `https://tv.apple.com/search?term=${query}`;
  if (name.includes('skyshowtime')) return `https://www.skyshowtime.com/search?q=${query}`;
  if (name.includes('voyo')) return `https://voyo.nova.cz/hledani?q=${query}`;
  return null;
}

/* ------------------------------ seriály ------------------------------ */

export interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

export interface Episode {
  episodeNumber: number;
  name: string;
  airDate?: string;
  overview?: string;
}

export async function tvSeasons(id: number): Promise<Season[]> {
  const data = await call<{
    seasons?: { season_number: number; name: string; episode_count: number }[];
  }>(`/tv/${id}`);
  return (data.seasons ?? [])
    // Nultá sezóna jsou speciály, ty do sledování dílů nepatří.
    .filter((s) => s.season_number > 0)
    .map((s) => ({ seasonNumber: s.season_number, name: s.name, episodeCount: s.episode_count }));
}

export async function tvEpisodes(id: number, season: number): Promise<Episode[]> {
  const data = await call<{
    episodes?: { episode_number: number; name: string; air_date?: string; overview?: string }[];
  }>(`/tv/${id}/season/${season}`);
  return (data.episodes ?? []).map((e) => ({
    episodeNumber: e.episode_number,
    name: e.name,
    airDate: e.air_date,
    overview: e.overview?.trim() || undefined,
  }));
}
