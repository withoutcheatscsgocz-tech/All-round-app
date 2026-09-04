import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { db } from '../../db/db';
import type { RadioStation, Track } from '../../db/types';

export interface NowPlaying {
  kind: 'track' | 'radio';
  id: number;
  title: string;
  subtitle?: string;
  /** U rádia se místo délky ukazuje „živě". */
  live: boolean;
}

interface PlayerState {
  current: NowPlaying | null;
  playing: boolean;
  /** Sekundy. */
  position: number;
  duration: number;
  queue: number[];
  queueIndex: number;
  error: string | null;
}

interface PlayerApi extends PlayerState {
  playTracks: (trackIds: number[], startIndex?: number) => void;
  playRadio: (station: RadioStation) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export function usePlayer(): PlayerApi {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer musí být uvnitř <PlayerProvider>');
  return ctx;
}

/**
 * Jediný <audio> element pro celou aplikaci. Žije v kořeni, takže
 * přepnutí modulu hudbu nepřeruší.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [state, setState] = useState<PlayerState>({
    current: null, playing: false, position: 0, duration: 0,
    queue: [], queueIndex: -1, error: null,
  });

  if (audioRef.current === null && typeof Audio !== 'undefined') {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const releaseUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  const loadTrack = useCallback(
    async (trackId: number, queue: number[], queueIndex: number) => {
      const audio = audioRef.current;
      if (!audio) return;
      const track = await db.tracks.get(trackId);
      if (!track) {
        setState((s) => ({ ...s, error: 'missing' }));
        return;
      }

      releaseUrl();
      objectUrlRef.current = URL.createObjectURL(track.blob);
      audio.src = objectUrlRef.current;

      setState((s) => ({
        ...s,
        current: {
          kind: 'track', id: trackId,
          title: track.title,
          subtitle: track.artist,
          live: false,
        },
        queue, queueIndex, position: 0, error: null,
      }));

      try {
        await audio.play();
      } catch {
        setState((s) => ({ ...s, playing: false }));
      }
    },
    [releaseUrl],
  );

  const playTracks = useCallback(
    (trackIds: number[], startIndex = 0) => {
      if (trackIds.length === 0) return;
      void loadTrack(trackIds[startIndex], trackIds, startIndex);
    },
    [loadTrack],
  );

  const playRadio = useCallback((station: RadioStation) => {
    const audio = audioRef.current;
    if (!audio) return;
    releaseUrl();
    audio.src = station.streamUrl;
    setState((s) => ({
      ...s,
      current: { kind: 'radio', id: station.id ?? -1, title: station.name, subtitle: station.genre, live: true },
      queue: [], queueIndex: -1, position: 0, duration: 0, error: null,
    }));
    void audio.play().catch(() => setState((s) => ({ ...s, error: 'stream', playing: false })));
  }, [releaseUrl]);

  const next = useCallback(() => {
    setState((s) => {
      if (s.queueIndex < 0 || s.queueIndex + 1 >= s.queue.length) return s;
      void loadTrack(s.queue[s.queueIndex + 1], s.queue, s.queueIndex + 1);
      return s;
    });
  }, [loadTrack]);

  const previous = useCallback(() => {
    const audio = audioRef.current;
    // Do tří sekund skoč na předchozí, jinak jen na začátek skladby.
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setState((s) => {
      if (s.queueIndex <= 0) return s;
      void loadTrack(s.queue[s.queueIndex - 1], s.queue, s.queueIndex - 1);
      return s;
    });
  }, [loadTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio?.src) return;
    if (audio.paused) void audio.play().catch(() => undefined);
    else audio.pause();
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) audio.currentTime = seconds;
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    releaseUrl();
    setState((s) => ({ ...s, current: null, playing: false, position: 0, duration: 0 }));
  }, [releaseUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setState((s) => ({ ...s, playing: true }));
    const onPause = () => setState((s) => ({ ...s, playing: false }));
    const onTime = () => setState((s) => ({ ...s, position: audio.currentTime }));
    const onMeta = () =>
      setState((s) => ({ ...s, duration: Number.isFinite(audio.duration) ? audio.duration : 0 }));
    const onEnded = () => next();
    const onError = () => setState((s) => ({ ...s, error: 'playback', playing: false }));

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [next]);

  // Ovládání ze zamčené obrazovky a ze sluchátek.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !state.current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: state.current.title,
      artist: state.current.subtitle ?? '',
    });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('nexttrack', state.queue.length > 1 ? next : null);
    navigator.mediaSession.setActionHandler('previoustrack', state.queue.length > 1 ? previous : null);
  }, [state.current, state.queue.length, toggle, next, previous]);

  useEffect(() => releaseUrl, [releaseUrl]);

  const api = useMemo<PlayerApi>(
    () => ({ ...state, playTracks, playRadio, toggle, next, previous, seek, stop }),
    [state, playTracks, playRadio, toggle, next, previous, seek, stop],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

/** Pomůcka pro seznam skladeb: 3:07 místo 187 sekund. */
export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0:00';
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export type { Track };
