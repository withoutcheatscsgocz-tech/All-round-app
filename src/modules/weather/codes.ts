/**
 * WMO kódy počasí (ww) používané Open-Meteo. Popis i ikona jsou čistá
 * funkce, aby se daly otestovat bez sítě.
 */
export interface WeatherDescription {
  icon: string;
  cs: string;
  en: string;
}

const CODES: Record<number, WeatherDescription> = {
  0: { icon: '☀️', cs: 'Jasno', en: 'Clear sky' },
  1: { icon: '🌤️', cs: 'Skoro jasno', en: 'Mainly clear' },
  2: { icon: '⛅', cs: 'Polojasno', en: 'Partly cloudy' },
  3: { icon: '☁️', cs: 'Zataženo', en: 'Overcast' },
  45: { icon: '🌫️', cs: 'Mlha', en: 'Fog' },
  48: { icon: '🌫️', cs: 'Namrzající mlha', en: 'Rime fog' },
  51: { icon: '🌦️', cs: 'Slabé mrholení', en: 'Light drizzle' },
  53: { icon: '🌦️', cs: 'Mrholení', en: 'Drizzle' },
  55: { icon: '🌧️', cs: 'Silné mrholení', en: 'Dense drizzle' },
  56: { icon: '🌧️', cs: 'Namrzající mrholení', en: 'Freezing drizzle' },
  57: { icon: '🌧️', cs: 'Silné namrzající mrholení', en: 'Dense freezing drizzle' },
  61: { icon: '🌦️', cs: 'Slabý déšť', en: 'Light rain' },
  63: { icon: '🌧️', cs: 'Déšť', en: 'Rain' },
  65: { icon: '🌧️', cs: 'Silný déšť', en: 'Heavy rain' },
  66: { icon: '🌧️', cs: 'Namrzající déšť', en: 'Freezing rain' },
  67: { icon: '🌧️', cs: 'Silný namrzající déšť', en: 'Heavy freezing rain' },
  71: { icon: '🌨️', cs: 'Slabé sněžení', en: 'Light snow' },
  73: { icon: '🌨️', cs: 'Sněžení', en: 'Snow' },
  75: { icon: '❄️', cs: 'Silné sněžení', en: 'Heavy snow' },
  77: { icon: '❄️', cs: 'Sněhová zrna', en: 'Snow grains' },
  80: { icon: '🌦️', cs: 'Slabé přeháňky', en: 'Light showers' },
  81: { icon: '🌧️', cs: 'Přeháňky', en: 'Showers' },
  82: { icon: '⛈️', cs: 'Silné přeháňky', en: 'Violent showers' },
  85: { icon: '🌨️', cs: 'Sněhové přeháňky', en: 'Snow showers' },
  86: { icon: '❄️', cs: 'Silné sněhové přeháňky', en: 'Heavy snow showers' },
  95: { icon: '⛈️', cs: 'Bouřka', en: 'Thunderstorm' },
  96: { icon: '⛈️', cs: 'Bouřka s kroupami', en: 'Thunderstorm with hail' },
  99: { icon: '⛈️', cs: 'Silná bouřka s kroupami', en: 'Severe thunderstorm with hail' },
};

const UNKNOWN: WeatherDescription = { icon: '🌡️', cs: 'Neznámé počasí', en: 'Unknown' };

export function describeWeather(code: number): WeatherDescription {
  return CODES[code] ?? UNKNOWN;
}

export function weatherLabel(code: number, lang: 'cs' | 'en' = 'cs'): string {
  return describeWeather(code)[lang];
}

export function weatherIcon(code: number): string {
  return describeWeather(code).icon;
}

/** Kódy, u kterých má smysl připomenout deštník. */
export function needsUmbrella(code: number): boolean {
  return code >= 51 && code !== 71 && code !== 73 && code !== 75 && code !== 77 && code !== 85 && code !== 86;
}
