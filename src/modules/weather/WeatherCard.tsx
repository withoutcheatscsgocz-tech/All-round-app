import { Link } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Card } from '../../components/ui';
import { useAsync } from '../../lib/useAsync';
import { getForecast } from './api';
import { needsUmbrella, weatherIcon, weatherLabel } from './codes';
import { useWeatherPlace } from './WeatherPage';

export function WeatherCard() {
  const { t, lang } = useI18n();
  const [place, , ready] = useWeatherPlace();

  const { data } = useAsync(
    () => getForecast(place!.latitude, place!.longitude),
    [place?.latitude, place?.longitude],
    Boolean(place),
  );

  // Bez vybraného místa ani bez dat kartu neukazuj — dashboard má být hutný.
  if (!ready || !place || !data) return null;

  const today = data.daily[0];
  const temp = (value: number) => `${Math.round(value)} °C`;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">🌤️ {place.name}</h3>
        <Link to="/weather" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-3xl">{weatherIcon(data.current.weatherCode)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-bold tabular-nums">{temp(data.current.temperature)}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {weatherLabel(data.current.weatherCode, lang)}
          </p>
        </div>
        {today && (
          <div className="shrink-0 text-right text-sm tabular-nums">
            <p className="font-semibold">{temp(today.max)}</p>
            <p className="text-[var(--color-muted)]">{temp(today.min)}</p>
          </div>
        )}
      </div>

      {needsUmbrella(data.current.weatherCode) && (
        <p className="mt-2 text-sm text-[var(--color-accent)]">☔ {t('weather.umbrella')}</p>
      )}
    </Card>
  );
}
