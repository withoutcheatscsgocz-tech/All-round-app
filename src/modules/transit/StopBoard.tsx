import { useEffect } from 'react';
import { useI18n } from '../../i18n';
import { Card, Pill } from '../../components/ui';
import { db } from '../../db/db';
import { useAsync } from '../../lib/useAsync';
import { modeIcon, stopTimes } from './api';
import { DelayBadge, clockTime } from './Itinerary';
import type { FavouriteStop } from '../../db/types';

const REFRESH_MS = 60_000;

/** Minuty do odjezdu, zaokrouhlené dolů — „za 3 min" znamená, že to ještě stihneš. */
export function minutesUntil(iso: string, now = Date.now()): number {
  return Math.floor((new Date(iso).getTime() - now) / 60_000);
}

export function StopBoard({ stop, limit = 8 }: { stop: FavouriteStop; limit?: number }) {
  const { t, lang } = useI18n();
  const { data: departures, error, loading, reload } = useAsync(
    () => stopTimes(stop.stopId, limit),
    [stop.stopId, limit],
  );

  // Tabule se sama obnovuje, ať na ni jde koukat jako na nádraží.
  useEffect(() => {
    const id = setInterval(reload, REFRESH_MS);
    return () => clearInterval(id);
  }, [reload]);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="truncate font-semibold">🚏 {stop.name}</h3>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={reload} className="text-sm text-[var(--color-muted)]" aria-label={t('transit.refresh')}>
            ↻
          </button>
          <button
            onClick={() => {
              if (confirm(t('common.confirmDelete'))) void db.favStops.delete(stop.id!);
            }}
            className="text-sm text-[var(--color-muted)]"
            aria-label={t('common.delete')}
          >
            ✕
          </button>
        </div>
      </div>

      {loading && !departures && <p className="py-2 text-sm text-[var(--color-muted)]">{t('app.loading')}</p>}
      {error && (
        <p className="py-2 text-sm text-[var(--color-muted)]">
          {error.message === 'offline' ? t('app.needsInternet') : error.message}
        </p>
      )}

      {departures && departures.length === 0 && (
        <p className="py-2 text-sm text-[var(--color-muted)]">{t('common.none')}</p>
      )}

      <ul className="divide-y divide-[var(--color-border)]">
        {departures?.map((dep, i) => {
          const mins = minutesUntil(dep.time);
          return (
            <li key={i} className="flex items-center gap-3 py-2">
              <span
                className="flex min-w-11 shrink-0 justify-center rounded px-1.5 py-1 text-xs font-bold"
                style={{
                  background: dep.routeColor ? `#${dep.routeColor}` : 'var(--color-surface-2)',
                  color: dep.routeColor ? `#${dep.routeTextColor ?? 'fff'}` : 'var(--color-text)',
                }}
              >
                {modeIcon(dep.mode)} {dep.line}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm ${dep.cancelled ? 'line-through opacity-60' : ''}`}>
                  {dep.headsign}
                </span>
                {dep.track && (
                  <span className="text-xs text-[var(--color-muted)]">
                    {t('transit.track')} {dep.track}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-right">
                {dep.cancelled ? (
                  <Pill tone="warn">{t('transit.cancelled')}</Pill>
                ) : (
                  <>
                    <span className="block font-semibold tabular-nums">
                      {mins <= 0 ? t('transit.now') : `${mins} ${t('transit.minShort')}`}
                    </span>
                    <span className="block text-xs text-[var(--color-muted)] tabular-nums">
                      {clockTime(dep.time, lang)}
                    </span>
                  </>
                )}
              </span>
              {dep.realTime && !dep.cancelled && (
                <DelayBadge actual={dep.time} scheduled={dep.scheduledTime} realTime />
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
