import { useI18n } from '../../i18n';
import { formatSeconds, usePlayer } from './player';

/** Lišta nad spodní navigací — pořád je vidět, co hraje. */
export function MiniPlayer() {
  const { t } = useI18n();
  const player = usePlayer();

  if (!player.current) return null;

  const progress = player.duration > 0 ? (player.position / player.duration) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/97 backdrop-blur">
      {!player.current.live && player.duration > 0 && (
        <div className="h-0.5 w-full bg-[var(--color-surface-2)]">
          <div className="h-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2">
        <span className="text-xl">{player.current.live ? '📻' : '🎵'}</span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{player.current.title}</p>
          <p className="truncate text-xs text-[var(--color-muted)]">
            {player.current.live
              ? t('music.live')
              : player.current.subtitle
                ? `${player.current.subtitle} · ${formatSeconds(player.position)}`
                : formatSeconds(player.position)}
          </p>
        </div>

        {player.queue.length > 1 && (
          <button onClick={player.previous} className="text-lg" aria-label="⏮">⏮</button>
        )}
        <button onClick={player.toggle} className="text-2xl" aria-label={player.playing ? '⏸' : '▶'}>
          {player.playing ? '⏸' : '▶️'}
        </button>
        {player.queue.length > 1 && (
          <button onClick={player.next} className="text-lg" aria-label="⏭">⏭</button>
        )}
        <button onClick={player.stop} className="text-sm text-[var(--color-muted)]" aria-label={t('common.close')}>
          ✕
        </button>
      </div>
    </div>
  );
}
