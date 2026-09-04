import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Card, Pill } from '../../components/ui';
import { formatDuration, plural } from '../../lib/date';
import { delayMinutes, isTransitMode, legLabel, modeIcon, type Itinerary, type Leg } from './api';

export function clockTime(iso: string, lang: 'cs' | 'en'): string {
  return new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function DelayBadge({ actual, scheduled, realTime }: { actual: string; scheduled?: string; realTime: boolean }) {
  const { t } = useI18n();
  if (!realTime) return null;
  const delay = delayMinutes(actual, scheduled);
  if (delay === 0) return <Pill tone="good">{t('transit.live')}</Pill>;
  return (
    <Pill tone={delay > 0 ? 'warn' : 'good'}>
      {delay > 0 ? t('transit.delayed', { min: delay }) : t('transit.early', { min: delay })}
    </Pill>
  );
}

function LegRow({ leg, lang }: { leg: Leg; lang: 'cs' | 'en' }) {
  const { t } = useI18n();
  const [openStops, setOpenStops] = useState(false);

  if (!isTransitMode(leg.mode)) {
    return (
      <div className="flex items-center gap-3 py-2 text-sm text-[var(--color-muted)]">
        <span className="w-6 text-center">{modeIcon(leg.mode)}</span>
        <span>
          {t('transit.walk')} · {formatDuration(Math.round(leg.duration / 60), lang)}
        </span>
      </div>
    );
  }

  const stops = leg.intermediateStops ?? [];

  return (
    <div className="border-l-2 py-1 pl-3" style={{ borderColor: leg.routeColor ? `#${leg.routeColor}` : 'var(--color-accent)' }}>
      <div className="flex items-baseline gap-2">
        <span className="tabular-nums font-semibold">{clockTime(leg.startTime, lang)}</span>
        <span className="min-w-0 flex-1 truncate">{leg.from.name}</span>
        {leg.from.track && (
          <span className="shrink-0 text-xs text-[var(--color-muted)]">{t('transit.track')} {leg.from.track}</span>
        )}
      </div>

      <div className="my-1 flex flex-wrap items-center gap-2 text-sm">
        <span
          className="rounded px-1.5 py-0.5 text-xs font-bold"
          style={{
            background: leg.routeColor ? `#${leg.routeColor}` : 'var(--color-accent)',
            color: leg.routeTextColor ? `#${leg.routeTextColor}` : '#fff',
          }}
        >
          {modeIcon(leg.mode)} {legLabel(leg)}
        </span>
        {leg.headsign && <span className="truncate text-[var(--color-muted)]">→ {leg.headsign}</span>}
        <DelayBadge actual={leg.startTime} scheduled={leg.scheduledStartTime} realTime={leg.realTime} />
        {leg.cancelled && <Pill tone="warn">{t('transit.cancelled')}</Pill>}
      </div>

      {stops.length > 0 && (
        <button
          onClick={() => setOpenStops((v) => !v)}
          className="mb-1 text-xs text-[var(--color-muted)] underline"
        >
          {openStops ? '▾' : '▸'} {stops.length}{' '}
          {plural(stops.length, {
            one: t('transit.stopOne'), few: t('transit.stopFew'), many: t('transit.stopMany'),
          }, lang)}
        </button>
      )}
      {openStops && (
        <ul className="mb-1 space-y-0.5 text-xs text-[var(--color-muted)]">
          {stops.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="tabular-nums">{s.departure ? clockTime(s.departure, lang) : ''}</span>
              <span className="truncate">{s.name}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-baseline gap-2">
        <span className="tabular-nums font-semibold">{clockTime(leg.endTime, lang)}</span>
        <span className="min-w-0 flex-1 truncate">{leg.to.name}</span>
        {leg.to.track && (
          <span className="shrink-0 text-xs text-[var(--color-muted)]">{t('transit.track')} {leg.to.track}</span>
        )}
      </div>
    </div>
  );
}

export function ItineraryCard({ itinerary }: { itinerary: Itinerary }) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);

  const transitLegs = itinerary.legs.filter((l) => isTransitMode(l.mode));
  const transferLabel =
    itinerary.transfers === 0
      ? t('transit.transfer0')
      : `${itinerary.transfers} ${plural(itinerary.transfers, {
          one: t('transit.transferOne'), few: t('transit.transferFew'), many: t('transit.transferMany'),
        }, lang)}`;

  return (
    <Card className="!p-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full p-4 text-left">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-bold tabular-nums">
            {clockTime(itinerary.startTime, lang)} → {clockTime(itinerary.endTime, lang)}
          </span>
          <span className="text-sm text-[var(--color-muted)]">
            {formatDuration(Math.round(itinerary.duration / 60), lang)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {transitLegs.map((leg, i) => (
            <span
              key={i}
              className="rounded px-1.5 py-0.5 text-xs font-bold"
              style={{
                background: leg.routeColor ? `#${leg.routeColor}` : 'var(--color-surface-2)',
                color: leg.routeColor ? `#${leg.routeTextColor ?? 'fff'}` : 'var(--color-text)',
              }}
            >
              {modeIcon(leg.mode)} {legLabel(leg)}
            </span>
          ))}
          <span className="text-xs text-[var(--color-muted)]">· {transferLabel}</span>
        </div>
      </button>

      {open && (
        <div className="space-y-1 border-t border-[var(--color-border)] px-4 py-3">
          {itinerary.legs.map((leg, i) => (
            <LegRow key={i} leg={leg} lang={lang} />
          ))}
        </div>
      )}
    </Card>
  );
}
