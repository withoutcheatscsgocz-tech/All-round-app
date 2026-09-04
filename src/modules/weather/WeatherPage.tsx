import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Input, Section, Sheet, Spinner } from '../../components/ui';
import { getSetting, setSetting } from '../../db/db';
import { useAsync, useDebounced } from '../../lib/useAsync';
import { currentPosition, getForecast, searchPlaces, type Place } from './api';
import { needsUmbrella, weatherIcon, weatherLabel } from './codes';

export const PLACE_KEY = 'weather.place';

export function useWeatherPlace(): [Place | null, (place: Place | null) => void, boolean] {
  const [place, setPlace] = useState<Place | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void getSetting<Place | null>(PLACE_KEY, null).then((stored) => {
      setPlace(stored);
      setReady(true);
    });
  }, []);

  const save = useCallback((next: Place | null) => {
    setPlace(next);
    void setSetting(PLACE_KEY, next);
  }, []);

  return [place, save, ready];
}

export function PlacePicker({ onPicked, onClose }: {
  onPicked: (place: Place) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const debounced = useDebounced(query, 400);

  const { data, loading } = useAsync(
    () => searchPlaces(debounced),
    [debounced],
    debounced.trim().length >= 2,
  );

  async function useMyLocation() {
    try {
      const pos = await currentPosition();
      onPicked({ name: t('weather.useLocation'), latitude: pos.latitude, longitude: pos.longitude });
    } catch {
      setError(t('weather.locationDenied'));
    }
  }

  return (
    <Sheet open onClose={onClose} title={t('weather.pickCity')}>
      <Button variant="primary" className="mb-3 w-full" onClick={() => void useMyLocation()}>
        📍 {t('weather.useLocation')}
      </Button>
      {error && <p className="mb-3 text-sm text-[var(--color-warn)]">{error}</p>}

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('weather.searchCity')}
        autoFocus
      />

      {loading && <Spinner />}
      <ul className="mt-2 max-h-72 divide-y divide-[var(--color-border)] overflow-y-auto">
        {data?.map((place) => (
          <li key={`${place.latitude},${place.longitude}`}>
            <button onClick={() => onPicked(place)} className="w-full py-2.5 text-left">
              <span className="block text-sm font-medium">{place.name}</span>
              <span className="block text-xs text-[var(--color-muted)]">
                {[place.admin, place.country].filter(Boolean).join(' · ')}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function clock(iso: string, lang: 'cs' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function WeatherPage() {
  const { t, lang } = useI18n();
  const [place, savePlace, ready] = useWeatherPlace();
  const [picking, setPicking] = useState(false);

  const { data, loading, error, reload } = useAsync(
    () => getForecast(place!.latitude, place!.longitude),
    [place?.latitude, place?.longitude],
    Boolean(place),
  );

  if (!ready) return null;

  if (!place) {
    return (
      <>
        <PageHeader title={t('weather.title')} />
        <EmptyState
          title={t('weather.noPlace')}
          action={<Button variant="primary" onClick={() => setPicking(true)}>📍 {t('weather.pickCity')}</Button>}
        />
        {picking && (
          <PlacePicker
            onPicked={(p) => { savePlace(p); setPicking(false); }}
            onClose={() => setPicking(false)}
          />
        )}
      </>
    );
  }

  const temp = (value: number) => `${Math.round(value)} °C`;
  const today = data?.daily[0];

  // Zbytek dneška a kus zítřka — celý týden po hodinách nikdo nečte.
  const upcomingHours = data?.hourly
    .filter((h) => new Date(h.time).getTime() >= Date.now() - 30 * 60_000)
    .slice(0, 24) ?? [];

  return (
    <>
      <PageHeader
        title={place.name}
        action={<Button variant="ghost" onClick={() => setPicking(true)}>{t('weather.change')}</Button>}
      />

      {loading && !data && <Spinner label={t('app.loading')} />}
      {error && (
        <Card className="mb-4">
          <p className="text-sm">{error.message === 'offline' ? t('app.needsInternet') : error.message}</p>
          <Button className="mt-3" onClick={reload}>{t('app.retry')}</Button>
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{weatherIcon(data.current.weatherCode)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-4xl font-bold tabular-nums">{temp(data.current.temperature)}</p>
                <p className="text-sm text-[var(--color-muted)]">
                  {weatherLabel(data.current.weatherCode, lang)}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  {t('weather.feelsLike', { temp: temp(data.current.feelsLike) })}
                </p>
              </div>
              {today && (
                <div className="shrink-0 text-right text-sm">
                  <p className="font-semibold tabular-nums">{temp(today.max)}</p>
                  <p className="text-[var(--color-muted)] tabular-nums">{temp(today.min)}</p>
                </div>
              )}
            </div>

            {needsUmbrella(data.current.weatherCode) && (
              <p className="mt-3 rounded-xl bg-[var(--color-accent-soft)] p-2.5 text-sm text-[var(--color-accent)]">
                ☔ {t('weather.umbrella')}
              </p>
            )}

            {today && (
              <div className="mt-3 flex flex-wrap gap-4 border-t border-[var(--color-border)] pt-3 text-xs text-[var(--color-muted)]">
                <span>💨 {t('weather.wind')} {Math.round(data.current.windSpeed)} km/h</span>
                <span>🌅 {clock(today.sunrise, lang)}</span>
                <span>🌇 {clock(today.sunset, lang)}</span>
              </div>
            )}
          </Card>

          <Section title={t('weather.hourly')}>
            <Card>
              <div className="flex gap-4 overflow-x-auto pb-1">
                {upcomingHours.map((hour) => (
                  <div key={hour.time} className="shrink-0 text-center">
                    <p className="text-xs text-[var(--color-muted)] tabular-nums">{clock(hour.time, lang)}</p>
                    <p className="my-1 text-xl">{weatherIcon(hour.weatherCode)}</p>
                    <p className="text-sm font-semibold tabular-nums">{temp(hour.temperature)}</p>
                    {hour.precipitationChance > 20 && (
                      <p className="text-[10px] text-[var(--color-accent)] tabular-nums">
                        {hour.precipitationChance} %
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          <Section title={t('weather.nextDays')}>
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {data.daily.map((day, index) => (
                  <li key={day.date} className="flex items-center gap-3 py-2">
                    <span className="w-16 shrink-0 text-sm first-letter:uppercase">
                      {index === 0
                        ? t('weather.today')
                        : new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', { weekday: 'short' })
                            .format(new Date(day.date))}
                    </span>
                    <span className="text-xl">{weatherIcon(day.weatherCode)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-muted)]">
                      {weatherLabel(day.weatherCode, lang)}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold">{temp(day.max)}</span>
                      <span className="ml-2 text-[var(--color-muted)]">{temp(day.min)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </Section>
        </>
      )}

      {picking && (
        <PlacePicker
          onPicked={(p) => { savePlace(p); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
