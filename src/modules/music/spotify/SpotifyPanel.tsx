import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '../../../i18n';
import { Button, Card, EmptyState, Field, Input, Pill, Section, Spinner } from '../../../components/ui';
import { redirectUri } from '../../../lib/pkce';
import { isNativeApp } from '../../../lib/platform';
import { useAsync, useDebounced } from '../../../lib/useAsync';
import { beginLogin, getClientId, getTokens, logout, setClientId } from './auth';
import * as api from './api';
import { isWebPlaybackSupported, useWebPlayback } from './useWebPlayback';
import { formatSeconds } from '../player';

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="mt-1 w-full rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-left font-mono text-xs break-all"
    >
      {copied ? '✓ ' : '📋 '}{value}
    </button>
  );
}

function Setup({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState('');

  return (
    <Card>
      <h3 className="mb-3 font-semibold">{t('spotify.setupTitle')}</h3>
      <ol className="space-y-2 text-sm text-[var(--color-muted)]">
        <li>{t('spotify.setupStep1')}</li>
        <li>{t('spotify.setupStep2')}</li>
        <li>
          {t('spotify.setupStep3')}
          <CopyRow value={redirectUri()} />
          {isNativeApp() && (
            <span className="mt-1 block text-xs">{t('spotify.setupNative')}</span>
          )}
        </li>
        <li>{t('spotify.setupStep4')}</li>
        <li>{t('spotify.setupStep5')}</li>
      </ol>

      <div className="mt-4">
        <Field label={t('spotify.clientId')}>
          <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        </Field>
      </div>
      <p className="mt-2 text-xs text-[var(--color-muted)]">{t('spotify.setupNote')}</p>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!value.trim()}
        onClick={() => void setClientId(value).then(onSaved)}
      >
        {t('common.save')}
      </Button>
    </Card>
  );
}

function TrackRow({
  track, onPlay,
}: {
  track: api.SpotifyTrack;
  onPlay: () => void;
}) {
  const cover = api.smallestImage(track.album.images);
  return (
    <li>
      <button onClick={onPlay} className="flex w-full items-center gap-3 py-2 text-left">
        {cover
          ? <img src={cover} alt="" className="h-10 w-10 shrink-0 rounded" loading="lazy" />
          : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-2)]">🎵</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{track.name}</span>
          <span className="block truncate text-xs text-[var(--color-muted)]">{api.artistNames(track)}</span>
        </span>
        <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
          {formatSeconds(track.duration_ms / 1000)}
        </span>
      </button>
    </li>
  );
}

type Tab = 'playlists' | 'saved' | 'search';

function Library({ onError }: { onError: (e: unknown) => void }) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('playlists');
  const [query, setQuery] = useState('');
  const [openPlaylist, setOpenPlaylist] = useState<api.SpotifyPlaylist | null>(null);
  const debounced = useDebounced(query, 400);

  const playlists = useAsync(() => api.myPlaylists(), [], tab === 'playlists');
  const saved = useAsync(() => api.savedTracks(), [], tab === 'saved');
  const found = useAsync(() => api.search(debounced), [debounced], tab === 'search' && debounced.trim().length > 1);
  const tracks = useAsync(
    () => api.playlistTracks(openPlaylist!.id),
    [openPlaylist?.id],
    Boolean(openPlaylist),
  );

  const run = useCallback(
    (fn: () => Promise<void>) => {
      fn().catch(onError);
    },
    [onError],
  );

  const tabs: { id: Tab; label: string }[] = [
    { id: 'playlists', label: t('spotify.playlists') },
    { id: 'saved', label: t('spotify.saved') },
    { id: 'search', label: t('common.search') },
  ];

  if (openPlaylist) {
    return (
      <Card>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="truncate font-semibold">{openPlaylist.name}</h3>
          <Button variant="ghost" onClick={() => setOpenPlaylist(null)}>{t('common.back')}</Button>
        </div>
        <Button
          variant="primary"
          className="mb-2 w-full"
          onClick={() => run(() => api.play({ contextUri: openPlaylist.uri }))}
        >
          ▶️ {t('music.playAll')}
        </Button>
        {tracks.loading && <Spinner />}
        <ul className="divide-y divide-[var(--color-border)]">
          {tracks.data?.map((track, index) => (
            <TrackRow
              key={`${track.id}-${index}`}
              track={track}
              onPlay={() => run(() => api.play({ contextUri: openPlaylist.uri, offsetPosition: index }))}
            />
          ))}
        </ul>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-3 flex gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 rounded-xl px-3 py-2 text-sm transition ${
              tab === item.id
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <Input
          className="mb-3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('spotify.searchSpotify')}
        />
      )}

      <Card>
        {(playlists.loading || saved.loading || found.loading) && <Spinner />}

        {tab === 'playlists' && (
          <ul className="divide-y divide-[var(--color-border)]">
            {playlists.data?.map((playlist) => (
              <li key={playlist.id}>
                <button
                  onClick={() => setOpenPlaylist(playlist)}
                  className="flex w-full items-center gap-3 py-2 text-left"
                >
                  {api.smallestImage(playlist.images)
                    ? <img src={api.smallestImage(playlist.images)} alt="" className="h-10 w-10 shrink-0 rounded" loading="lazy" />
                    : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[var(--color-surface-2)]">🎧</span>}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{playlist.name}</span>
                    <span className="block text-xs text-[var(--color-muted)]">
                      {playlist.tracks.total} {t('spotify.tracks').toLowerCase()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {playlists.data?.length === 0 && <li className="py-2 text-sm text-[var(--color-muted)]">{t('common.none')}</li>}
          </ul>
        )}

        {tab === 'saved' && (
          <ul className="divide-y divide-[var(--color-border)]">
            {saved.data?.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                onPlay={() => run(() => api.play({ uris: saved.data!.slice(index).map((s) => s.uri) }))}
              />
            ))}
          </ul>
        )}

        {tab === 'search' && (
          <ul className="divide-y divide-[var(--color-border)]">
            {found.data?.tracks.map((track) => (
              <TrackRow key={track.id} track={track} onPlay={() => run(() => api.play({ uris: [track.uri] }))} />
            ))}
            {found.data && found.data.tracks.length === 0 && (
              <li className="py-2 text-sm text-[var(--color-muted)]">{t('common.none')}</li>
            )}
          </ul>
        )}
      </Card>
    </>
  );
}

function Controls({ onError }: { onError: (e: unknown) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<api.PlaybackState | undefined>();
  const [deviceList, setDeviceList] = useState<api.SpotifyDevice[]>([]);
  const [playHere, setPlayHere] = useState(false);
  const web = useWebPlayback(playHere);

  const refresh = useCallback(async () => {
    try {
      setState(await api.playbackState());
      setDeviceList(await api.devices());
    } catch (err) {
      onError(err);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 10_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Jakmile je prohlížeč připravený jako zařízení, přesměruj na něj přehrávání.
  useEffect(() => {
    if (web.ready && web.deviceId) {
      api.transferPlayback(web.deviceId, false).then(refresh).catch(onError);
    }
  }, [web.ready, web.deviceId, refresh, onError]);

  const run = (fn: () => Promise<void>) => {
    fn().then(() => setTimeout(() => void refresh(), 400)).catch(onError);
  };

  const track = state?.item;

  return (
    <Card className="mb-4">
      {track ? (
        <div className="mb-3 flex items-center gap-3">
          {api.smallestImage(track.album.images) && (
            <img src={api.smallestImage(track.album.images)} alt="" className="h-14 w-14 rounded" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{track.name}</p>
            <p className="truncate text-sm text-[var(--color-muted)]">{api.artistNames(track)}</p>
            {state?.device && <Pill tone="accent">{state.device.name}</Pill>}
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-[var(--color-muted)]">{t('spotify.noDevices')}</p>
      )}

      <div className="flex items-center justify-center gap-4 text-2xl">
        <button onClick={() => run(api.previousTrack)} aria-label="⏮">⏮</button>
        <button
          onClick={() => run(state?.is_playing ? api.pause : () => api.play())}
          aria-label={state?.is_playing ? '⏸' : '▶'}
          className="text-3xl"
        >
          {state?.is_playing ? '⏸' : '▶️'}
        </button>
        <button onClick={() => run(api.nextTrack)} aria-label="⏭">⏭</button>
        <button
          onClick={() => run(() => api.setShuffle(!state?.shuffle_state))}
          aria-label={t('spotify.shuffle')}
          className={state?.shuffle_state ? 'text-[var(--color-accent)]' : ''}
        >
          🔀
        </button>
      </div>

      <div className="mt-4 border-t border-[var(--color-border)] pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            {t('spotify.devices')}
          </span>
          <Button variant="ghost" onClick={() => void refresh()}>↻</Button>
        </div>

        {isWebPlaybackSupported() ? (
          <label className="mb-2 flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={playHere} onChange={(e) => setPlayHere(e.target.checked)} />
            {t('spotify.playHere')}
            {web.error && <span className="text-xs text-[var(--color-warn)]">{web.error}</span>}
          </label>
        ) : (
          <p className="mb-2 text-xs text-[var(--color-muted)]">{t('spotify.desktopOnly')}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {deviceList.map((device) => (
            <button
              key={device.id ?? device.name}
              onClick={() => device.id && run(() => api.transferPlayback(device.id!))}
              className={`rounded-xl px-3 py-2 text-sm transition ${
                device.is_active
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
              }`}
            >
              {device.name}
            </button>
          ))}
          {deviceList.length === 0 && (
            <p className="text-sm text-[var(--color-muted)]">{t('spotify.noDevices')}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SpotifyPanel() {
  const { t } = useI18n();
  const [clientId, setId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setId(await getClientId());
    setLoggedIn(Boolean(await getTokens()));
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const profile = useAsync(() => api.me(), [loggedIn], loggedIn === true);

  const onError = useCallback((err: unknown) => {
    const code = err instanceof api.SpotifyError ? err.message : String(err);
    setError(
      code === 'no-active-device' ? t('spotify.noActiveDevice')
      : code === 'forbidden' ? t('spotify.forbidden')
      : code === 'not-logged-in' ? t('spotify.notLoggedIn')
      : code,
    );
    setTimeout(() => setError(null), 6000);
  }, [t]);

  if (loggedIn === null) return null;

  if (!clientId) {
    return (
      <Section title={t('spotify.title')}>
        <Setup onSaved={() => void reload()} />
      </Section>
    );
  }

  if (!loggedIn) {
    return (
      <Section title={t('spotify.title')}>
        <EmptyState
          title={t('spotify.title')}
          hint={t('spotify.premiumNote')}
          action={
            <Button variant="primary" onClick={() => void beginLogin().catch(onError)}>
              {t('spotify.connect')}
            </Button>
          }
        />
        <Button
          className="mt-2 w-full"
          onClick={() => void setClientId('').then(reload)}
        >
          {t('spotify.clientId')} ✕
        </Button>
      </Section>
    );
  }

  return (
    <Section
      title={t('spotify.title')}
      action={
        <Button variant="ghost" onClick={() => void logout().then(reload)}>
          {t('spotify.disconnect')}
        </Button>
      }
    >
      {profile.data && (
        <p className="mb-2 px-1 text-xs text-[var(--color-muted)]">
          {t('spotify.connected', { name: profile.data.display_name ?? profile.data.id })}
          {profile.data.product !== 'premium' && ` · ${t('spotify.premiumNote')}`}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-xl bg-[var(--color-warn)]/10 p-3 text-sm text-[var(--color-warn)]">{error}</p>
      )}
      <Controls onError={onError} />
      <Library onError={onError} />
    </Section>
  );
}
