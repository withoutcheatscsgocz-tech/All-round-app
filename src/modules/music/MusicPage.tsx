import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Field, Input, Section, Sheet } from '../../components/ui';
import { db, requestPersistentStorage } from '../../db/db';
import { addTrackFile, seedCzechRadios, shuffled } from './data';
import { formatSeconds, usePlayer } from './player';
import type { RadioStation } from '../../db/types';

function TrackList() {
  const { t } = useI18n();
  const player = usePlayer();
  const fileRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const tracks = useLiveQuery(() => db.tracks.orderBy('title').toArray(), [], []);
  const ids = tracks.map((track) => track.id!);

  async function addFiles(files: FileList) {
    const list = [...files];
    setProgress({ done: 0, total: list.length });
    for (const [index, file] of list.entries()) {
      await addTrackFile(file);
      setProgress({ done: index + 1, total: list.length });
    }
    // Bez trvalého úložiště může prohlížeč nahranou hudbu kdykoli vyhodit.
    await requestPersistentStorage();
    setProgress(null);
  }

  return (
    <Section
      title={t('music.myMusic')}
      action={
        tracks.length > 0 ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => player.playTracks(ids)}>▶️ {t('music.playAll')}</Button>
            <Button variant="ghost" onClick={() => player.playTracks(shuffled(ids))}>🔀</Button>
          </div>
        ) : undefined
      }
    >
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {tracks.length === 0 ? (
        <EmptyState
          title={t('music.noTracks')}
          hint={t('music.addFilesHint')}
          action={
            <Button variant="primary" onClick={() => fileRef.current?.click()}>
              + {t('music.addFiles')}
            </Button>
          }
        />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {tracks.map((track, index) => {
              const active = player.current?.kind === 'track' && player.current.id === track.id;
              return (
                <li key={track.id} className="flex items-center gap-3 py-2">
                  <button
                    onClick={() => player.playTracks(ids, index)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className={`block truncate text-sm ${active ? 'font-semibold text-[var(--color-accent)]' : ''}`}>
                      {active && player.playing ? '▶ ' : ''}{track.title}
                    </span>
                    {track.artist && (
                      <span className="block truncate text-xs text-[var(--color-muted)]">{track.artist}</span>
                    )}
                  </button>
                  {track.durationSec !== undefined && (
                    <span className="shrink-0 text-xs text-[var(--color-muted)] tabular-nums">
                      {formatSeconds(track.durationSec)}
                    </span>
                  )}
                  <button
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) void db.tracks.delete(track.id!);
                    }}
                    className="shrink-0 text-[var(--color-muted)]"
                    aria-label={t('music.deleteTrack')}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
          <Button className="mt-3 w-full" onClick={() => fileRef.current?.click()}>
            + {t('music.addFiles')}
          </Button>
        </Card>
      )}

      {progress && (
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          {t('music.importing', progress)}
        </p>
      )}
    </Section>
  );
}

function RadioList() {
  const { t } = useI18n();
  const player = usePlayer();
  const [adding, setAdding] = useState(false);
  const radios = useLiveQuery(() => db.radios.toArray(), [], []);

  return (
    <Section
      title={t('music.radio')}
      action={<Button variant="ghost" onClick={() => setAdding(true)}>+ {t('music.addRadio')}</Button>}
    >
      {radios.length === 0 ? (
        <EmptyState
          title={t('music.noRadios')}
          action={<Button variant="primary" onClick={() => void seedCzechRadios()}>📻 {t('music.seedRadios')}</Button>}
        />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {radios.map((station) => {
              const active = player.current?.kind === 'radio' && player.current.id === station.id;
              return (
                <li key={station.id} className="flex items-center gap-3 py-2">
                  <button onClick={() => player.playRadio(station)} className="min-w-0 flex-1 text-left">
                    <span className={`block truncate text-sm ${active ? 'font-semibold text-[var(--color-accent)]' : ''}`}>
                      {active && player.playing ? '▶ ' : ''}{station.name}
                    </span>
                    {station.genre && (
                      <span className="block truncate text-xs text-[var(--color-muted)]">{station.genre}</span>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('common.confirmDelete'))) void db.radios.delete(station.id!);
                    }}
                    className="shrink-0 text-[var(--color-muted)]"
                    aria-label={t('common.delete')}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {adding && <RadioEditor onClose={() => setAdding(false)} />}
    </Section>
  );
}

function RadioEditor({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const [station, setStation] = useState<Omit<RadioStation, 'id'>>({
    name: '', streamUrl: '', genre: '', favorite: 0,
  });

  return (
    <Sheet open onClose={onClose} title={t('music.addRadio')}>
      <div className="space-y-3">
        <Field label={t('music.radioName')}>
          <Input value={station.name} onChange={(e) => setStation((s) => ({ ...s, name: e.target.value }))} />
        </Field>
        <Field label={t('music.radioUrl')}>
          <Input
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={station.streamUrl}
            onChange={(e) => setStation((s) => ({ ...s, streamUrl: e.target.value }))}
          />
        </Field>
        <Field label={t('music.radioGenre')}>
          <Input value={station.genre} onChange={(e) => setStation((s) => ({ ...s, genre: e.target.value }))} />
        </Field>
      </div>
      <Button
        variant="primary"
        className="mt-4 w-full"
        disabled={!station.name.trim() || !station.streamUrl.trim()}
        onClick={() => void db.radios.add(station).then(onClose)}
      >
        {t('common.save')}
      </Button>
    </Sheet>
  );
}

export function MusicPage() {
  const { t } = useI18n();
  const player = usePlayer();

  return (
    <>
      <PageHeader title={t('music.title')} />

      {player.error && (
        <p className="mb-4 rounded-xl bg-[var(--color-bad)]/10 p-3 text-sm text-[var(--color-bad)]">
          {player.error === 'stream' ? t('music.streamError') : t('music.playbackError')}
        </p>
      )}

      <TrackList />
      <RadioList />
    </>
  );
}
