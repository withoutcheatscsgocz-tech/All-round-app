import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Pill, Section, Spinner } from '../../components/ui';
import { db } from '../../db/db';
import { useAsync } from '../../lib/useAsync';
import * as tmdb from './api';
import type { WatchItem } from '../../db/types';

const OFFER_LABELS = {
  flatrate: 'watch.subscription',
  ads: 'watch.withAds',
  rent: 'watch.rent',
  buy: 'watch.buy',
} as const;

function Providers({ item }: { item: WatchItem }) {
  const { t } = useI18n();
  const { data, loading, error } = useAsync(
    () => tmdb.watchProviders(item.kind, item.tmdbId),
    [item.kind, item.tmdbId],
  );

  if (loading) return <Spinner />;
  if (error) {
    return (
      <p className="text-sm text-[var(--color-warn)]">
        {error.message === 'bad-key' ? t('watch.badKey') : error.message}
      </p>
    );
  }
  if (!data || data.providers.length === 0) {
    return (
      <Card>
        <p className="text-sm text-[var(--color-muted)]">{t('watch.noProviders')}</p>
        {data?.link && (
          <a href={data.link} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-[var(--color-accent)] underline">
            {t('watch.allOptions')}
          </a>
        )}
      </Card>
    );
  }

  // Předplatné je to, co člověk hledá první — půjčovné a koupě až pak.
  const groups = (['flatrate', 'ads', 'rent', 'buy'] as const)
    .map((offer) => ({ offer, list: data.providers.filter((p) => p.offer === offer) }))
    .filter((group) => group.list.length > 0);

  return (
    <Card>
      {groups.map(({ offer, list }) => (
        <div key={offer} className="mb-4 last:mb-0">
          <p className="mb-2 text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            {t(OFFER_LABELS[offer])}
          </p>
          <div className="flex flex-wrap gap-2">
            {list.map((provider) => {
              const deepLink = tmdb.providerDeepLink(provider.name, item.title);
              const href = deepLink ?? data.link;
              const logo = tmdb.logoUrl(provider.logo);
              return (
                <a
                  key={`${offer}-${provider.id}`}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm transition hover:bg-[var(--color-surface-2)]"
                >
                  {logo && <img src={logo} alt="" className="h-6 w-6 rounded" loading="lazy" />}
                  <span>{provider.name}</span>
                  {deepLink && <span className="text-[var(--color-accent)]">↗</span>}
                </a>
              );
            })}
          </div>
        </div>
      ))}

      {data.link && (
        <a href={data.link} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-muted)] underline">
          {t('watch.allOptions')}
        </a>
      )}
    </Card>
  );
}

function Episodes({ item }: { item: WatchItem }) {
  const { t } = useI18n();
  const [openSeason, setOpenSeason] = useState<number | null>(null);

  const seasons = useAsync(() => tmdb.tvSeasons(item.tmdbId), [item.tmdbId]);
  const episodes = useAsync(
    () => tmdb.tvEpisodes(item.tmdbId, openSeason!),
    [item.tmdbId, openSeason],
    openSeason !== null,
  );
  const watched = useLiveQuery(
    () => db.watchProgress.where('itemId').equals(item.id!).toArray(),
    [item.id],
    [],
  );

  const isWatched = (season: number, episode: number) =>
    watched.some((w) => w.season === season && w.episode === episode);

  async function toggle(season: number, episode: number) {
    const existing = watched.find((w) => w.season === season && w.episode === episode);
    if (existing?.id !== undefined) {
      await db.watchProgress.delete(existing.id);
    } else {
      await db.watchProgress.add({ itemId: item.id!, season, episode, watchedAt: Date.now() });
      if (item.status === 'watchlist') await db.watchItems.update(item.id!, { status: 'watching' });
    }
  }

  if (seasons.loading) return <Spinner />;
  if (!seasons.data?.length) return null;

  return (
    <Card>
      {seasons.data.map((season) => {
        const done = watched.filter((w) => w.season === season.seasonNumber).length;
        const open = openSeason === season.seasonNumber;
        return (
          <div key={season.seasonNumber} className="border-b border-[var(--color-border)] py-2 last:border-0">
            <button
              onClick={() => setOpenSeason(open ? null : season.seasonNumber)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{season.name}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {t('watch.progress', { done, total: season.episodeCount })}
                </span>
              </span>
              <span className="shrink-0 text-[var(--color-muted)]">{open ? '▾' : '▸'}</span>
            </button>

            {open && (
              <div className="mt-2">
                {episodes.loading && <Spinner />}
                <ul className="space-y-0.5">
                  {episodes.data?.map((episode) => {
                    const seen = isWatched(season.seasonNumber, episode.episodeNumber);
                    return (
                      <li key={episode.episodeNumber}>
                        <button
                          onClick={() => void toggle(season.seasonNumber, episode.episodeNumber)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--color-surface-2)]"
                        >
                          <span className={`shrink-0 ${seen ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}`}>
                            {seen ? '☑' : '☐'}
                          </span>
                          <span className="w-8 shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                            {season.seasonNumber}×{String(episode.episodeNumber).padStart(2, '0')}
                          </span>
                          <span className={`min-w-0 flex-1 truncate ${seen ? 'text-[var(--color-muted)]' : ''}`}>
                            {episode.name}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

export function WatchDetail() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { kind, id } = useParams();
  const tmdbId = Number(id);
  const mediaKind = kind === 'tv' ? 'tv' : 'movie';

  const item = useLiveQuery(
    () => db.watchItems.where('[kind+tmdbId]').equals([mediaKind, tmdbId]).first(),
    [mediaKind, tmdbId],
  );

  if (item === undefined) return <Spinner label={t('app.loading')} />;
  if (!item) {
    return (
      <>
        <PageHeader title={t('watch.title')} />
        <p>{t('common.none')}</p>
      </>
    );
  }

  const poster = tmdb.posterUrl(item.poster, 'w342');
  const statuses: WatchItem['status'][] = ['watchlist', 'watching', 'done'];
  const statusLabels = {
    watchlist: t('watch.watchlist'),
    watching: t('watch.watching'),
    done: t('watch.done'),
  };

  return (
    <>
      <PageHeader
        title={item.title}
        action={<Link to="/watch" className="text-sm text-[var(--color-accent)]">{t('common.back')}</Link>}
      />

      <div className="mb-4 flex gap-4">
        {poster && <img src={poster} alt="" className="h-40 w-28 shrink-0 rounded-xl object-cover" />}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-2">
            {item.year && <Pill>{item.year}</Pill>}
            {item.rating !== undefined && item.rating > 0 && <Pill tone="accent">★ {item.rating}</Pill>}
            <Pill tone="night">{t(item.kind === 'tv' ? 'watch.typeTv' : 'watch.typeMovie')}</Pill>
          </div>
          {item.overview && (
            <p className="line-clamp-6 text-sm text-[var(--color-muted)]">{item.overview}</p>
          )}
        </div>
      </div>

      <div className="mb-5 flex gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            onClick={() => void db.watchItems.update(item.id!, { status })}
            className={`flex-1 rounded-xl px-2 py-2 text-xs transition ${
              item.status === status
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
            }`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      <Section title={t('watch.whereToWatch')}>
        <Providers item={item} />
      </Section>

      {item.kind === 'tv' && (
        <Section title={t('watch.seasons')}>
          <Episodes item={item} />
        </Section>
      )}

      <Button
        variant="danger"
        className="mb-4 w-full"
        onClick={() => {
          if (!confirm(t('common.confirmDelete'))) return;
          void db.watchProgress.where('itemId').equals(item.id!).delete()
            .then(() => db.watchItems.delete(item.id!))
            .then(() => navigate('/watch'));
        }}
      >
        {t('watch.remove')}
      </Button>
    </>
  );
}
