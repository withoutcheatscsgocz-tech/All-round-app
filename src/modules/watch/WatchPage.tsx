import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Field, Input, Spinner } from '../../components/ui';
import { db } from '../../db/db';
import { useAsync, useDebounced } from '../../lib/useAsync';
import * as tmdb from './api';
import type { WatchItem } from '../../db/types';

function Setup({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  return (
    <Card>
      <h3 className="mb-3 font-semibold">{t('watch.setupTitle')}</h3>
      <ol className="space-y-2 text-sm text-[var(--color-muted)]">
        <li>{t('watch.setupStep1')}</li>
        <li>{t('watch.setupStep2')}</li>
        <li>{t('watch.setupStep3')}</li>
      </ol>
      <div className="mt-4">
        <Field label={t('watch.apiKey')}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">{t('watch.setupNote')}</p>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!value.trim()}
        onClick={() => void tmdb.setApiKey(value).then(onSaved)}
      >
        {t('common.save')}
      </Button>
    </Card>
  );
}

export function PosterTile({
  title, year, poster, rating, onClick, badge,
}: {
  title: string;
  year?: number;
  poster?: string;
  rating?: number;
  onClick: () => void;
  badge?: string;
}) {
  const url = tmdb.posterUrl(poster, 'w154');
  return (
    <button onClick={onClick} className="text-left">
      <div className="relative aspect-2/3 w-full overflow-hidden rounded-xl bg-[var(--color-surface-2)]">
        {url
          ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
          : <span className="flex h-full items-center justify-center text-2xl">🎬</span>}
        {rating !== undefined && rating > 0 && (
          <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ★ {rating}
          </span>
        )}
        {badge && (
          <span className="absolute top-1 left-1 rounded bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-medium">{title}</p>
      {year && <p className="text-[11px] text-[var(--color-muted)]">{year}</p>}
    </button>
  );
}

type Tab = 'watchlist' | 'watching' | 'done' | 'search';

export function WatchPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('watchlist');
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 400);

  const items = useLiveQuery(() => db.watchItems.reverse().sortBy('addedAt'), [], []);

  const reload = useCallback(async () => {
    setHasKey(Boolean(await tmdb.getApiKey()));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const results = useAsync(
    () => tmdb.searchMulti(debounced),
    [debounced],
    hasKey === true && tab === 'search' && debounced.trim().length > 1,
  );
  const trending = useAsync(
    () => tmdb.trending(),
    [],
    hasKey === true && tab === 'search' && debounced.trim().length <= 1,
  );

  if (hasKey === null) return null;

  if (!hasKey) {
    return (
      <>
        <PageHeader title={t('watch.title')} />
        <p className="mb-4 rounded-xl bg-[var(--color-surface-2)] p-3 text-sm text-[var(--color-muted)]">
          {t('watch.netflixNote')}
        </p>
        <Setup onSaved={() => void reload()} />
      </>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'watchlist', label: t('watch.watchlist') },
    { id: 'watching', label: t('watch.watching') },
    { id: 'done', label: t('watch.done') },
    { id: 'search', label: t('common.search') },
  ];

  const shown = items.filter((item) => item.status === tab);
  const searchList = debounced.trim().length > 1 ? results : trending;
  const savedIds = new Set(items.map((item) => `${item.kind}-${item.tmdbId}`));

  return (
    <>
      <PageHeader title={t('watch.title')} />

      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`truncate rounded-xl px-2 py-2 text-xs transition ${
              tab === item.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'search' ? (
        <>
          <Input
            className="mb-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('watch.search')}
          />
          {searchList.loading && <Spinner />}
          {searchList.error && (
            <p className="mb-3 text-sm text-[var(--color-warn)]">
              {searchList.error.message === 'bad-key' ? t('watch.badKey') : searchList.error.message}
            </p>
          )}
          {debounced.trim().length <= 1 && (
            <h2 className="mb-2 px-1 text-sm font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              {t('watch.trending')}
            </h2>
          )}
          <div className="grid grid-cols-3 gap-3">
            {searchList.data?.map((hit) => (
              <PosterTile
                key={`${hit.kind}-${hit.tmdbId}`}
                title={hit.title}
                year={hit.year}
                poster={hit.poster}
                rating={hit.rating}
                badge={savedIds.has(`${hit.kind}-${hit.tmdbId}`) ? '✓' : undefined}
                onClick={() => void openDetail(hit)}
              />
            ))}
          </div>
        </>
      ) : shown.length === 0 ? (
        <EmptyState title={t('watch.emptyWatchlist')} action={
          <Button variant="primary" onClick={() => setTab('search')}>🔍 {t('watch.search')}</Button>
        } />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {shown.map((item) => (
            <Link key={item.id} to={`/watch/${item.kind}/${item.tmdbId}`}>
              <PosterTile
                title={item.title}
                year={item.year}
                poster={item.poster}
                rating={item.rating}
                onClick={() => undefined}
              />
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 mb-2 text-center text-xs text-[var(--color-muted)]">
        <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" className="underline">TMDB</a>
        {' · JustWatch'}
      </p>
    </>
  );

  /** Z hledání se rovnou uloží do knihovny, ať je na co odkázat v detailu. */
  async function openDetail(hit: tmdb.SearchHit) {
    const existing = await db.watchItems.where('[kind+tmdbId]').equals([hit.kind, hit.tmdbId]).first();
    if (!existing) {
      const record: WatchItem = {
        kind: hit.kind,
        tmdbId: hit.tmdbId,
        title: hit.title,
        year: hit.year,
        poster: hit.poster,
        overview: hit.overview,
        rating: hit.rating,
        status: 'watchlist',
        addedAt: Date.now(),
      };
      await db.watchItems.add(record);
    }
    navigate(`/watch/${hit.kind}/${hit.tmdbId}`);
  }
}
