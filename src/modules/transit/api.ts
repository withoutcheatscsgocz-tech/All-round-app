/**
 * Klient nad Transitous (https://transitous.org), což je veřejná instance
 * routeru MOTIS. Nepotřebuje žádný klíč a má otevřené CORS, takže se volá
 * rovnou z prohlížeče. Data pokrývají celostátní vlaky i autobusy,
 * PID Praha včetně zpoždění, IDS JMK a další krajské systémy.
 */

const BASE = 'https://api.transitous.org';

export type TransitMode =
  | 'WALK' | 'BIKE' | 'CAR' | 'BUS' | 'COACH' | 'TRAM' | 'SUBWAY' | 'METRO'
  | 'RAIL' | 'HIGHSPEED_RAIL' | 'LONG_DISTANCE' | 'NIGHT_RAIL'
  | 'REGIONAL_RAIL' | 'REGIONAL_FAST_RAIL' | 'FERRY' | 'AIRPLANE' | 'OTHER';

export interface Place {
  name: string;
  stopId?: string;
  lat: number;
  lon: number;
  /** Nástupiště nebo kolej, když ho dopravce hlásí. */
  track?: string;
  arrival?: string;
  departure?: string;
  scheduledArrival?: string;
  scheduledDeparture?: string;
}

export interface GeocodeResult extends Place {
  id: string;
  type: string;
  /** Obec / kraj, aby se daly rozlišit stejnojmenné zastávky. */
  area?: string;
  modes?: TransitMode[];
}

export interface Leg {
  mode: TransitMode;
  from: Place;
  to: Place;
  startTime: string;
  endTime: string;
  scheduledStartTime?: string;
  scheduledEndTime?: string;
  /** Sekundy. */
  duration: number;
  realTime: boolean;
  cancelled?: boolean;
  routeShortName?: string;
  routeLongName?: string;
  headsign?: string;
  agencyName?: string;
  routeColor?: string;
  routeTextColor?: string;
  intermediateStops?: Place[];
}

export interface Itinerary {
  id: string;
  startTime: string;
  endTime: string;
  /** Sekundy. */
  duration: number;
  transfers: number;
  legs: Leg[];
}

export interface Departure {
  mode: TransitMode;
  line: string;
  headsign: string;
  /** Skutečný čas odjezdu (u realtime už i se zpožděním). */
  time: string;
  scheduledTime?: string;
  realTime: boolean;
  cancelled: boolean;
  track?: string;
  routeColor?: string;
  routeTextColor?: string;
  agencyName?: string;
}

export class TransitError extends Error {}

/** Na slabém signálu se dotaz radši vzdá, než aby appka věčně točila kolečko. */
const TIMEOUT_MS = 15_000;

async function request<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const url = new URL(BASE + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new TransitError('offline');
  }
  if (!res.ok) throw new TransitError(`HTTP ${res.status}`);

  const data: unknown = await res.json();
  if (typeof data === 'object' && data !== null && 'error' in data) {
    throw new TransitError(String((data as { error: unknown }).error));
  }
  return data as T;
}

/* ----------------------------- našeptávač ---------------------------- */

interface RawArea { name: string; adminLevel: number; matched?: boolean; default?: boolean }
interface RawGeocode extends Place { id: string; type: string; areas?: RawArea[]; modes?: TransitMode[] }

/** Z hierarchie oblastí vybere tu, která zastávku nejlíp odliší (obvykle obec). */
function pickArea(areas: RawArea[] | undefined): string | undefined {
  if (!areas?.length) return undefined;
  const town = areas.find((a) => a.default) ?? areas.find((a) => a.adminLevel === 8);
  const region = areas.find((a) => a.adminLevel === 4);
  return [town?.name, region?.name].filter(Boolean).join(' · ') || undefined;
}

export async function geocode(text: string, limit = 8): Promise<GeocodeResult[]> {
  if (text.trim().length < 2) return [];
  const raw = await request<RawGeocode[]>('/api/v1/geocode', { text, language: 'cs' });
  return raw.slice(0, limit).map((r) => ({
    id: r.id,
    type: r.type,
    name: r.name,
    stopId: r.type === 'STOP' ? r.id : undefined,
    lat: r.lat,
    lon: r.lon,
    area: pickArea(r.areas),
    modes: r.modes,
  }));
}

/* ------------------------------ spojení ------------------------------ */

export interface PlanQuery {
  from: { lat: number; lon: number };
  to: { lat: number; lon: number };
  /** Kdy — podle arriveBy buď odjezd, nebo nejzazší příjezd. */
  time: Date;
  arriveBy?: boolean;
  numItineraries?: number;
  /** Maximální chůze v metrech k první a od poslední zastávky. */
  maxWalkMeters?: number;
}

export async function plan(query: PlanQuery): Promise<Itinerary[]> {
  const data = await request<{ itineraries?: Itinerary[] }>('/api/v3/plan', {
    fromPlace: `${query.from.lat},${query.from.lon}`,
    toPlace: `${query.to.lat},${query.to.lon}`,
    time: query.time.toISOString(),
    arriveBy: query.arriveBy ?? false,
    numItineraries: query.numItineraries ?? 5,
    maxPreTransitTime: 1200,
    maxPostTransitTime: 1200,
    ...(query.maxWalkMeters ? { maxMatchingDistance: query.maxWalkMeters } : {}),
  });
  return data.itineraries ?? [];
}

/* -------------------------- odjezdová tabule ------------------------- */

interface RawStopTime {
  place: Place & { departure?: string; scheduledDeparture?: string; track?: string };
  mode: TransitMode;
  realTime: boolean;
  headsign?: string;
  routeShortName?: string;
  displayName?: string;
  routeColor?: string;
  routeTextColor?: string;
  agencyName?: string;
  cancelled?: boolean;
  tripCancelled?: boolean;
}

export async function stopTimes(stopId: string, count = 12): Promise<Departure[]> {
  const data = await request<{ stopTimes?: RawStopTime[] }>('/api/v1/stoptimes', {
    stopId,
    n: count,
    // Zastávka jako celek (všechna nástupiště), ne jen jeden sloupek.
    exactRadius: false,
  });

  return (data.stopTimes ?? [])
    .filter((st) => st.place.departure)
    .map((st) => ({
      mode: st.mode,
      line: st.routeShortName || st.displayName || '',
      headsign: st.headsign ?? '',
      time: st.place.departure!,
      scheduledTime: st.place.scheduledDeparture,
      realTime: st.realTime,
      cancelled: Boolean(st.cancelled || st.tripCancelled),
      track: st.place.track,
      routeColor: st.routeColor,
      routeTextColor: st.routeTextColor,
      agencyName: st.agencyName,
    }));
}

/* ------------------------------ pomocné ------------------------------ */

const MODE_ICONS: Record<string, string> = {
  WALK: '🚶', BIKE: '🚲', CAR: '🚗',
  BUS: '🚌', COACH: '🚌',
  TRAM: '🚊', SUBWAY: '🚇', METRO: '🚇',
  RAIL: '🚆', HIGHSPEED_RAIL: '🚄', LONG_DISTANCE: '🚄',
  NIGHT_RAIL: '🌙', REGIONAL_RAIL: '🚆', REGIONAL_FAST_RAIL: '🚆',
  FERRY: '⛴️', AIRPLANE: '✈️',
};

export function modeIcon(mode: TransitMode): string {
  return MODE_ICONS[mode] ?? '🚏';
}

export function isTransitMode(mode: TransitMode): boolean {
  return mode !== 'WALK' && mode !== 'BIKE' && mode !== 'CAR';
}

/** Zpoždění v minutách oproti jízdnímu řádu; 0 když nejede realtime. */
export function delayMinutes(actual: string, scheduled?: string): number {
  if (!scheduled) return 0;
  return Math.round((new Date(actual).getTime() - new Date(scheduled).getTime()) / 60_000);
}

/** Popisek linky do seznamu: „RJ 1030" nebo „12". */
export function legLabel(leg: Leg): string {
  return leg.routeShortName || leg.routeLongName || leg.mode;
}
