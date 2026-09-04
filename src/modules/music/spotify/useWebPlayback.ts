import { useEffect, useState } from 'react';
import { getAccessToken } from './auth';

const SDK_SRC = 'https://sdk.scdn.co/spotify-player.js';

/**
 * Web Playback SDK udělá z prohlížeče plnohodnotné přehrávací zařízení.
 * Spotify ho ale podporuje jen na počítači — na mobilních prohlížečích
 * nefunguje (kvůli DRM a pravidlům pro automatické přehrávání), takže tam
 * appka zůstane u dálkového ovládání přes Spotify Connect.
 */
export function isWebPlaybackSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua);
  return !mobile;
}

interface SpotifyPlayerInstance {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload: never) => void) => boolean;
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (window.Spotify) {
      resolve();
      return;
    }
    window.onSpotifyWebPlaybackSDKReady = () => resolve();
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onerror = () => reject(new Error('sdk-load-failed'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export interface WebPlaybackState {
  /** ID zařízení, na které se dá poslat přehrávání. */
  deviceId: string | null;
  ready: boolean;
  error: string | null;
}

export function useWebPlayback(enabled: boolean): WebPlaybackState {
  const [state, setState] = useState<WebPlaybackState>({
    deviceId: null, ready: false, error: null,
  });

  useEffect(() => {
    if (!enabled || !isWebPlaybackSupported()) return;

    let player: SpotifyPlayerInstance | null = null;
    let cancelled = false;

    void (async () => {
      try {
        await loadSdk();
        if (cancelled || !window.Spotify) return;

        player = new window.Spotify.Player({
          name: 'All-round app',
          getOAuthToken: (cb) => {
            void getAccessToken().then((token) => {
              if (token) cb(token);
            });
          },
          volume: 0.7,
        });

        player.addListener('ready', ((payload: { device_id: string }) => {
          setState({ deviceId: payload.device_id, ready: true, error: null });
        }) as never);

        player.addListener('not_ready', (() => {
          setState((s) => ({ ...s, ready: false }));
        }) as never);

        for (const event of ['initialization_error', 'authentication_error', 'account_error', 'playback_error']) {
          player.addListener(event, ((payload: { message: string }) => {
            setState((s) => ({ ...s, error: payload?.message ?? event }));
          }) as never);
        }

        await player.connect();
      } catch (err) {
        if (!cancelled) {
          setState((s) => ({ ...s, error: err instanceof Error ? err.message : String(err) }));
        }
      }
    })();

    return () => {
      cancelled = true;
      player?.disconnect();
    };
  }, [enabled]);

  return state;
}
