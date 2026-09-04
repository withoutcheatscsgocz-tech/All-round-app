import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, ErrorBox, Field, Input, Section, Sheet, Spinner } from '../../components/ui';
import { db } from '../../db/db';
import { useAsync } from '../../lib/useAsync';
import { plan } from './api';
import { PlaceInput, type SelectedPlace } from './PlaceInput';
import { ItineraryCard } from './Itinerary';
import { StopBoard } from './StopBoard';
import type { SavedRoute } from '../../db/types';

function localDateTimeValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TransitPage() {
  const { t } = useI18n();
  const [from, setFrom] = useState<SelectedPlace | null>(null);
  const [to, setTo] = useState<SelectedPlace | null>(null);
  const [when, setWhen] = useState(() => localDateTimeValue(new Date()));
  const [arriveBy, setArriveBy] = useState(false);
  const [submitted, setSubmitted] = useState(0);
  const [saveOpen, setSaveOpen] = useState(false);

  const routes = useLiveQuery(() => db.savedRoutes.toArray(), [], []);
  const stops = useLiveQuery(() => db.favStops.orderBy('order').toArray(), [], []);

  const { data: itineraries, error, loading, reload } = useAsync(
    () => plan({ from: from!, to: to!, time: new Date(when), arriveBy, numItineraries: 6 }),
    [submitted],
    submitted > 0 && Boolean(from && to),
  );

  function loadRoute(route: SavedRoute) {
    setFrom({ name: route.fromName, lat: route.fromLat, lon: route.fromLon });
    setTo({ name: route.toName, lat: route.toLat, lon: route.toLon });
    setWhen(localDateTimeValue(new Date()));
    setArriveBy(false);
    setSubmitted((n) => n + 1);
  }

  return (
    <>
      <PageHeader title={t('transit.title')} />

      <Card className="mb-4">
        <div className="space-y-3">
          <PlaceInput label={t('transit.from')} value={from} onChange={setFrom} />
          <div className="flex justify-center">
            <Button
              variant="ghost"
              className="!px-2 !py-1"
              onClick={() => { setFrom(to); setTo(from); }}
              aria-label={t('transit.swap')}
            >
              ⇅
            </Button>
          </div>
          <PlaceInput label={t('transit.to')} value={to} onChange={setTo} />

          <div className="flex gap-2">
            <button
              onClick={() => setArriveBy(false)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${
                !arriveBy ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
              }`}
            >
              {t('transit.depart')}
            </button>
            <button
              onClick={() => setArriveBy(true)}
              className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${
                arriveBy ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
              }`}
            >
              {t('transit.arrive')}
            </button>
          </div>

          <div className="flex gap-2">
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => setWhen(localDateTimeValue(new Date()))}>{t('transit.now')}</Button>
          </div>

          <div className="flex gap-2">
            <Button
              variant="primary"
              className="flex-1"
              disabled={!from || !to}
              onClick={() => setSubmitted((n) => n + 1)}
            >
              🔍 {t('transit.findConnection')}
            </Button>
            {from && to && (
              <Button onClick={() => setSaveOpen(true)} aria-label={t('transit.saveRoute')}>★</Button>
            )}
          </div>
        </div>
      </Card>

      {loading && <Spinner label={t('app.loading')} />}
      {error && (
        <ErrorBox
          message={error.message === 'offline' ? t('app.needsInternet') : error.message}
          onRetry={reload}
          retryLabel={t('app.retry')}
        />
      )}
      {itineraries && itineraries.length === 0 && !loading && (
        <EmptyState title={t('transit.noResults')} />
      )}
      {itineraries && itineraries.length > 0 && (
        <div className="mb-6 space-y-3">
          {itineraries.map((it) => (
            <ItineraryCard key={it.id} itinerary={it} />
          ))}
        </div>
      )}

      {routes.length > 0 && (
        <Section title={t('transit.savedRoutes')}>
          <div className="space-y-2">
            {routes.map((route) => (
              <Card key={route.id} onClick={() => loadRoute(route)}>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {route.isCommute && '💼 '}{route.name}
                    </p>
                    <p className="truncate text-sm text-[var(--color-muted)]">
                      {route.fromName} → {route.toName}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(t('common.confirmDelete'))) void db.savedRoutes.delete(route.id!);
                    }}
                    className="shrink-0 text-[var(--color-muted)]"
                    aria-label={t('common.delete')}
                  >
                    ✕
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <Section title={t('transit.favStops')}>
        {stops.length === 0 ? (
          <EmptyState title={t('transit.noStops')} />
        ) : (
          <div className="space-y-3">
            {stops.map((stop) => (
              <StopBoard key={stop.id} stop={stop} />
            ))}
          </div>
        )}
        <AddStop />
      </Section>

      <p className="mt-6 mb-2 text-center text-xs text-[var(--color-muted)]">{t('transit.dataSource')}</p>

      {saveOpen && from && to && (
        <SaveRouteSheet from={from} to={to} onClose={() => setSaveOpen(false)} />
      )}
    </>
  );
}

function AddStop() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<SelectedPlace | null>(null);

  async function save() {
    if (!place?.stopId) return;
    const count = await db.favStops.count();
    await db.favStops.put({
      stopId: place.stopId,
      name: place.name,
      lat: place.lat,
      lon: place.lon,
      order: count,
    });
    setPlace(null);
    setOpen(false);
  }

  return (
    <>
      <Button className="mt-3 w-full" onClick={() => setOpen(true)}>+ {t('transit.addStop')}</Button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={t('transit.addStop')}>
          <PlaceInput label={t('transit.favStops')} value={place} onChange={setPlace} />
          <Button
            variant="primary"
            className="mt-4 w-full"
            disabled={!place?.stopId}
            onClick={() => void save()}
          >
            {t('common.save')}
          </Button>
          {place && !place.stopId && (
            <p className="mt-2 text-sm text-[var(--color-warn)]">
              {t('transit.searchStop')}
            </p>
          )}
        </Sheet>
      )}
    </>
  );
}

function SaveRouteSheet({
  from, to, onClose,
}: {
  from: SelectedPlace;
  to: SelectedPlace;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(`${from.name} → ${to.name}`);
  const [isCommute, setIsCommute] = useState(false);

  async function save() {
    if (isCommute) {
      // Cesta do práce může být jen jedna, jinak by dashboard nevěděl, kterou počítat.
      const previous = await db.savedRoutes.filter((r) => r.isCommute).toArray();
      await Promise.all(previous.map((r) => db.savedRoutes.update(r.id!, { isCommute: false })));
    }
    await db.savedRoutes.put({
      name: name.trim() || `${from.name} → ${to.name}`,
      fromName: from.name, fromLat: from.lat, fromLon: from.lon,
      toName: to.name, toLat: to.lat, toLon: to.lon,
      isCommute,
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('transit.saveRoute')}>
      <Field label={t('transit.routeName')}>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <label className="mt-4 flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={isCommute}
          onChange={(e) => setIsCommute(e.target.checked)}
        />
        {t('transit.isCommute')}
      </label>
      <p className="mt-1 text-xs text-[var(--color-muted)]">{t('transit.isCommuteHint')}</p>
      <Button variant="primary" className="mt-4 w-full" onClick={() => void save()}>
        {t('common.save')}
      </Button>
    </Sheet>
  );
}
