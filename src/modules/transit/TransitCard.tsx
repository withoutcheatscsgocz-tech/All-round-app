import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card, Pill } from '../../components/ui';
import { addDays, todayIso } from '../../lib/date';
import { useAsync } from '../../lib/useAsync';
import { shiftInterval } from '../shifts/pay';
import { useShiftTypeMap } from '../shifts/data';
import { isTransitMode, legLabel, modeIcon, plan } from './api';
import { clockTime } from './Itinerary';
import { StopBoard } from './StopBoard';

/**
 * Vezme nejbližší šichtu a spočítá spojení tak, aby se dorazilo před jejím
 * začátkem. Tohle je celý smysl toho, mít šichty a spoje v jedné appce.
 */
function CommuteCard() {
  const { t, lang } = useI18n();
  const types = useShiftTypeMap();

  const commute = useLiveQuery(() => db.savedRoutes.filter((r) => r.isCommute).first(), [], undefined);
  const upcoming = useLiveQuery(async () => {
    const today = todayIso();
    const shifts = await db.shifts
      .where('date')
      .between(today, addDays(today, 3), true, true)
      .toArray();
    return shifts
      .filter((s) => s.kind === 'work')
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [], undefined);

  const interval = upcoming
    ? shiftInterval(upcoming, upcoming.typeId ? types.get(upcoming.typeId) : undefined)
    : null;

  // Chceme být na místě chvíli před začátkem, ne přesně na minutu.
  const arriveBy = interval ? new Date(interval.start.getTime() - 5 * 60_000) : null;
  const alreadyStarted = arriveBy ? arriveBy.getTime() < Date.now() : false;

  const { data: itineraries } = useAsync(
    () => plan({
      from: { lat: commute!.fromLat, lon: commute!.fromLon },
      to: { lat: commute!.toLat, lon: commute!.toLon },
      time: arriveBy!,
      arriveBy: true,
      numItineraries: 1,
    }),
    [commute?.id, arriveBy?.getTime()],
    Boolean(commute && arriveBy && !alreadyStarted),
  );

  if (!commute || !interval || alreadyStarted) return null;

  const best = itineraries?.[0];
  if (!best) return null;

  const departure = new Date(best.startTime);
  const minsUntilLeave = Math.floor((departure.getTime() - Date.now()) / 60_000);
  const transitLegs = best.legs.filter((l) => isTransitMode(l.mode));

  return (
    <div className="mt-3 rounded-xl bg-[var(--color-accent-soft)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-[var(--color-accent)]">
          💼 {minsUntilLeave <= 0
            ? t('transit.leaveNow')
            : minsUntilLeave < 60
              ? t('transit.leaveIn', { min: minsUntilLeave })
              : t('transit.leaveAt', { time: clockTime(best.startTime, lang) })}
        </span>
        <span className="text-sm tabular-nums text-[var(--color-muted)]">
          {clockTime(best.startTime, lang)}
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--color-muted)]">
        {t('transit.arriveBefore', {
          time: clockTime(best.endTime, lang),
          start: clockTime(interval.start.toISOString(), lang),
        })}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {transitLegs.map((leg, i) => (
          <span
            key={i}
            className="rounded px-1.5 py-0.5 text-xs font-bold"
            style={{
              background: leg.routeColor ? `#${leg.routeColor}` : 'var(--color-surface)',
              color: leg.routeColor ? `#${leg.routeTextColor ?? 'fff'}` : 'var(--color-text)',
            }}
          >
            {modeIcon(leg.mode)} {legLabel(leg)}
          </span>
        ))}
        {best.transfers === 0 && <Pill tone="good">{t('transit.transfer0')}</Pill>}
      </div>
    </div>
  );
}

export function TransitCard() {
  const { t } = useI18n();
  const stops = useLiveQuery(() => db.favStops.orderBy('order').limit(1).toArray(), [], []);
  const routes = useLiveQuery(() => db.savedRoutes.count(), [], 0);

  if (stops.length === 0 && routes === 0) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">🚌 {t('transit.title')}</h3>
          <Link to="/transit" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
        </div>
        <p className="mt-1 text-sm text-[var(--color-muted)]">{t('transit.noStops')}</p>
      </Card>
    );
  }

  return (
    <div>
      {stops[0] ? <StopBoard stop={stops[0]} limit={4} /> : (
        <Card>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">🚌 {t('transit.title')}</h3>
            <Link to="/transit" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
          </div>
        </Card>
      )}
      <CommuteCard />
    </div>
  );
}
