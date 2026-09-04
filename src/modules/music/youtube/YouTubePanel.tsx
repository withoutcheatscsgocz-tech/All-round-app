import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useI18n } from '../../../i18n';
import { Button, Card, EmptyState, Field, Input, Section, Sheet, Spinner } from '../../../components/ui';
import { db } from '../../../db/db';
import { isNativeApp } from '../../../lib/platform';
import { useAsync, useDebounced } from '../../../lib/useAsync';
import { embedUrl, parseYouTubeUrl, thumbnailUrl, type YouTubeRef } from './parse';
import { getYouTubeClientId, getStoredToken, requestToken, setYouTubeClientId, youtubeLogout } from './auth';
import * as api from './api';
import type { MediaLink } from '../../../db/types';

function Player({ refValue, onClose }: { refValue: YouTubeRef; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mb-4">
      <div className="aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={embedUrl(refValue, true)}
          title="YouTube"
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-[var(--color-muted)]">{t('youtube.playsInPlayer')}</p>
        <Button variant="ghost" onClick={onClose}>{t('common.close')}</Button>
      </div>
    </div>
  );
}

function AddLink({ onAdded }: { onAdded: (ref: YouTubeRef) => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState(false);

  async function save() {
    const parsed = parseYouTubeUrl(url);
    if (!parsed) {
      setError(true);
      return;
    }
    await db.mediaLinks.add({
      kind: 'youtube',
      refType: parsed.kind,
      refId: parsed.playlistId && parsed.kind === 'video' ? `${parsed.id}|${parsed.playlistId}` : parsed.id,
      title: title.trim() || url.trim(),
      thumb: thumbnailUrl(parsed),
      addedAt: Date.now(),
    });
    setUrl('');
    setTitle('');
    setOpen(false);
    onAdded(parsed);
  }

  return (
    <>
      <Button className="w-full" onClick={() => setOpen(true)}>+ {t('youtube.addLink')}</Button>
      {open && (
        <Sheet open onClose={() => setOpen(false)} title={t('youtube.addLink')}>
          <Field label={t('youtube.linkUrl')}>
            <Input
              type="url"
              inputMode="url"
              value={url}
              placeholder="https://youtube.com/…"
              onChange={(e) => { setUrl(e.target.value); setError(false); }}
            />
          </Field>
          <div className="mt-3">
            <Field label={t('youtube.linkTitle')}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
          </div>
          {error && <p className="mt-2 text-sm text-[var(--color-warn)]">{t('youtube.invalidLink')}</p>}
          <Button variant="primary" className="mt-4 w-full" disabled={!url.trim()} onClick={() => void save()}>
            {t('common.save')}
          </Button>
        </Sheet>
      )}
    </>
  );
}

function storedToRef(link: MediaLink): YouTubeRef {
  const [id, playlistId] = link.refId.split('|');
  return link.refType === 'playlist'
    ? { kind: 'playlist', id }
    : { kind: 'video', id, playlistId };
}

function Connected({ onPlay, onDisconnect }: {
  onPlay: (ref: YouTubeRef) => void;
  onDisconnect: () => void;
}) {
  const { t } = useI18n();
  const [openPlaylist, setOpenPlaylist] = useState<api.YouTubePlaylist | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebounced(query, 400);

  const playlists = useAsync(() => api.myPlaylists(), [], !openPlaylist);
  const items = useAsync(() => api.playlistItems(openPlaylist!.id), [openPlaylist?.id], Boolean(openPlaylist));
  const found = useAsync(() => api.searchVideos(debounced), [debounced], debounced.trim().length > 1);

  const videoRow = (video: api.YouTubeVideo) => (
    <li key={video.id}>
      <button
        onClick={() => onPlay({ kind: 'video', id: video.id, playlistId: openPlaylist?.id })}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        {video.thumbnail && <img src={video.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded object-cover" loading="lazy" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{video.title}</span>
          {video.channel && <span className="block truncate text-xs text-[var(--color-muted)]">{video.channel}</span>}
        </span>
      </button>
    </li>
  );

  if (openPlaylist) {
    return (
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="truncate font-semibold">{openPlaylist.title}</h3>
          <Button variant="ghost" onClick={() => setOpenPlaylist(null)}>{t('common.back')}</Button>
        </div>
        <Button
          variant="primary"
          className="mb-2 w-full"
          onClick={() => onPlay({ kind: 'playlist', id: openPlaylist.id })}
        >
          ▶️ {t('music.playAll')}
        </Button>
        {items.loading && <Spinner />}
        <ul className="divide-y divide-[var(--color-border)]">{items.data?.map(videoRow)}</ul>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button variant="ghost" onClick={onDisconnect}>{t('youtube.disconnect')}</Button>
      </div>

      <Input
        className="mb-3"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('youtube.searchYoutube')}
      />

      {debounced.trim().length > 1 ? (
        <Card>
          {found.loading && <Spinner />}
          <ul className="divide-y divide-[var(--color-border)]">{found.data?.map(videoRow)}</ul>
        </Card>
      ) : (
        <Card>
          {playlists.loading && <Spinner />}
          {playlists.error && <p className="text-sm text-[var(--color-warn)]">{playlists.error.message}</p>}
          <ul className="divide-y divide-[var(--color-border)]">
            {playlists.data?.map((playlist) => (
              <li key={playlist.id}>
                <button onClick={() => setOpenPlaylist(playlist)} className="flex w-full items-center gap-3 py-2 text-left">
                  {playlist.thumbnail && <img src={playlist.thumbnail} alt="" className="h-10 w-16 shrink-0 rounded object-cover" loading="lazy" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{playlist.title}</span>
                    <span className="block text-xs text-[var(--color-muted)]">{playlist.itemCount} 🎬</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Setup({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const origin = location.origin;

  return (
    <Card>
      <h3 className="mb-3 font-semibold">{t('youtube.setupTitle')}</h3>
      <ol className="space-y-2 text-sm text-[var(--color-muted)]">
        <li>{t('youtube.setupStep1')}</li>
        <li>{t('youtube.setupStep2')}</li>
        <li>{t('youtube.setupStep3')}</li>
        <li>
          {t('youtube.setupStep4')}
          <span className="mt-1 block rounded-lg bg-[var(--color-surface-2)] px-3 py-2 font-mono text-xs break-all">
            {origin}
          </span>
        </li>
        <li>{t('youtube.setupStep6')}</li>
      </ol>
      <div className="mt-4">
        <Field label={t('youtube.clientId')}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">{t('youtube.setupNote')}</p>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!value.trim()}
        onClick={() => void setYouTubeClientId(value).then(onSaved)}
      >
        {t('common.save')}
      </Button>
    </Card>
  );
}

export function YouTubePanel() {
  const { t } = useI18n();
  const [playing, setPlaying] = useState<YouTubeRef | null>(null);
  const [clientId, setId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const links = useLiveQuery(
    () => db.mediaLinks.where('kind').equals('youtube').reverse().toArray(),
    [],
    [],
  );

  const reload = useCallback(async () => {
    setId(await getYouTubeClientId());
    setToken(await getStoredToken());
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function connect() {
    try {
      await requestToken(true);
      await reload();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Section title={t('youtube.title')}>
      {playing && <Player refValue={playing} onClose={() => setPlaying(null)} />}

      {token ? (
        <Connected
          onPlay={setPlaying}
          onDisconnect={() => void youtubeLogout().then(reload)}
        />
      ) : (
        <>
          {links.length === 0 ? (
            <EmptyState title={t('youtube.noLinks')} />
          ) : (
            <Card className="mb-3">
              <ul className="divide-y divide-[var(--color-border)]">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center gap-3 py-2">
                    <button onClick={() => setPlaying(storedToRef(link))} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      {link.thumb
                        ? <img src={link.thumb} alt="" className="h-10 w-16 shrink-0 rounded object-cover" loading="lazy" />
                        : <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-[var(--color-surface-2)]">▶</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{link.title}</span>
                        <span className="block text-xs text-[var(--color-muted)]">
                          {link.refType === 'playlist' ? t('youtube.myPlaylists') : t('youtube.videos')}
                        </span>
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t('common.confirmDelete'))) void db.mediaLinks.delete(link.id!);
                      }}
                      className="shrink-0 text-[var(--color-muted)]"
                      aria-label={t('common.delete')}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <AddLink onAdded={setPlaying} />

          <div className="mt-3">
            {isNativeApp() ? (
              <p className="text-xs text-[var(--color-muted)]">{t('youtube.nativeNote')}</p>
            ) : clientId ? (
              <Button className="w-full" onClick={() => void connect()}>
                🔑 {t('youtube.connect')}
              </Button>
            ) : setupOpen ? (
              <Setup onSaved={() => { setSetupOpen(false); void reload(); }} />
            ) : (
              <Button variant="ghost" className="w-full" onClick={() => setSetupOpen(true)}>
                {t('youtube.setupTitle')}
              </Button>
            )}
            {error && <p className="mt-2 text-sm text-[var(--color-warn)]">{error}</p>}
          </div>
        </>
      )}
    </Section>
  );
}
