import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card } from '../../components/ui';
import { posterUrl } from './api';

export function WatchCard() {
  const { t } = useI18n();
  const watching = useLiveQuery(
    () => db.watchItems.where('status').equals('watching').reverse().sortBy('addedAt'),
    [],
    [],
  );

  if (watching.length === 0) return null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">🎬 {t('watch.unwatched')}</h3>
        <Link to="/watch" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {watching.slice(0, 6).map((item) => {
          const poster = posterUrl(item.poster, 'w154');
          return (
            <Link key={item.id} to={`/watch/${item.kind}/${item.tmdbId}`} className="w-16 shrink-0">
              <div className="aspect-2/3 overflow-hidden rounded-lg bg-[var(--color-surface-2)]">
                {poster
                  ? <img src={poster} alt="" className="h-full w-full object-cover" loading="lazy" />
                  : <span className="flex h-full items-center justify-center">🎬</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-[10px]">{item.title}</p>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
