import { cached } from '../../lib/cache';

/**
 * Open-Meteo — předpověď zdarma, bez klíče a s otevřeným CORS, takže se
 * volá rovnou z prohlížeče. Časy chodí už v pásmu zvolené lokality.
 */
const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING = 'https://geocoding-api.open-meteo.com/v1/search';

const CACHE_MS = 30 * 60_000;

export class WeatherError extends Error {}

export interface Place {
  name: string;
  country?: string;
  admin?: string;
  latitude: number;
  longitude: number;
}

export interface CurrentWeather {
  time: string;
  temperature: number;
  feelsLike: number;
  weatherCode: number;
  windSpeed: number;
  precipitation: number;
}

export interface DailyForecast {
  date: string;
  weatherCode: number;
  max: number;
  min: number;
  precipitationSum: number;
  sunrise: string;
  sunset: string;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitationChance: number;
}

export interface Forecast {
  current: CurrentWeather;
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

async function fetchJson<T>(url: URL): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new WeatherError('offline');
  }
  if (!res.ok) throw new WeatherError(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

interface RawForecast {
  current: {
    time: string; temperature_2m: number; apparent_temperature: number;
    weather_code: number; wind_speed_10m: number; precipitation: number;
  };
  daily: {
    time: string[]; weather_code: number[]; temperature_2m_max: number[];
    temperature_2m_min: number[]; precipitation_sum: number[];
    sunrise: string[]; sunset: string[];
  };
  hourly: {
    time: string[]; temperature_2m: number[]; weather_code: number[];
    precipitation_probability: number[];
  };
}

export function mapForecast(raw: RawForecast): Forecast {
  return {
    current: {
      time: raw.current.time,
      temperature: raw.current.temperature_2m,
      feelsLike: raw.current.apparent_temperature,
      weatherCode: raw.current.weather_code,
      windSpeed: raw.current.wind_speed_10m,
      precipitation: raw.current.precipitation,
    },
    daily: raw.daily.time.map((date, i) => ({
      date,
      weatherCode: raw.daily.weather_code[i],
      max: raw.daily.temperature_2m_max[i],
      min: raw.daily.temperature_2m_min[i],
      precipitationSum: raw.daily.precipitation_sum[i],
      sunrise: raw.daily.sunrise[i],
      sunset: raw.daily.sunset[i],
    })),
    hourly: raw.hourly.time.map((time, i) => ({
      time,
      temperature: raw.hourly.temperature_2m[i],
      weatherCode: raw.hourly.weather_code[i],
      precipitationChance: raw.hourly.precipitation_probability[i],
    })),
  };
}

export async function getForecast(lat: number, lon: number): Promise<Forecast> {
  // Zaokrouhlení na tři místa stačí na přesnost a šetří to cache.
  const key = `weather:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return cached(key, CACHE_MS, async () => {
    const url = new URL(FORECAST);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation');
    url.searchParams.set('hourly', 'temperature_2m,weather_code,precipitation_probability');
    url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,sunrise,sunset');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', '7');
    return mapForecast(await fetchJson<RawForecast>(url));
  });
}

interface RawPlace {
  name: string; latitude: number; longitude: number;
  country?: string; admin1?: string;
}

export async function searchPlaces(query: string): Promise<Place[]> {
  if (query.trim().length < 2) return [];
  const url = new URL(GEOCODING);
  url.searchParams.set('name', query);
  url.searchParams.set('count', '8');
  url.searchParams.set('language', 'cs');
  url.searchParams.set('format', 'json');

  const data = await fetchJson<{ results?: RawPlace[] }>(url);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    country: r.country,
    admin: r.admin1,
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}

/** Poloha z prohlížeče. Uživatel ji musí povolit, jinak si vybere město ručně. */
export function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new WeatherError('no-geolocation'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => reject(new WeatherError('denied')),
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
}
