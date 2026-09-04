import { db, getSetting, setSetting } from '../../../db/db';

/**
 * Google Identity Services, token model. Pro appku, která běží jen
 * v prohlížeči, je to správná cesta — client secret ani redirect URI
 * nejsou potřeba, stačí povolený JavaScript origin.
 *
 * Token platí zhruba hodinu a refresh token se v tomhle modelu nevydává,
 * takže po vypršení se o nový požádá znovu (obvykle bez dalšího klikání).
 */
const GIS_SRC = 'https://accounts.google.com/gsi/client';
export const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

const CLIENT_ID_KEY = 'youtube.clientId';
const TOKEN_KEY = 'youtube.token';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, done?: () => void) => void;
        };
      };
    };
  }
}

export function getYouTubeClientId(): Promise<string> {
  return getSetting(CLIENT_ID_KEY, '');
}

export async function setYouTubeClientId(id: string): Promise<void> {
  await setSetting(CLIENT_ID_KEY, id.trim());
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('gis-load-failed'));
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Vyžádá token. `interactive: false` zkusí projít potichu — hodí se, když
 * jen vypršel ten předchozí a uživatel by nechápal, proč zase klikat.
 */
export async function requestToken(interactive = true): Promise<string | null> {
  const clientId = await getYouTubeClientId();
  if (!clientId) throw new Error('missing-client-id');

  await loadGis();
  const oauth2 = window.google?.accounts.oauth2;
  if (!oauth2) throw new Error('gis-unavailable');

  return new Promise<string | null>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: YOUTUBE_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error ?? 'no-token'));
          return;
        }
        const stored: StoredToken = {
          accessToken: response.access_token,
          expiresAt: Date.now() + ((response.expires_in ?? 3600) - 60) * 1000,
        };
        void setSetting(TOKEN_KEY, stored).then(() => resolve(stored.accessToken));
      },
      error_callback: (error) => reject(new Error(error?.type ?? 'cancelled')),
    });
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

export async function getStoredToken(): Promise<string | null> {
  const stored = await getSetting<StoredToken | null>(TOKEN_KEY, null);
  if (!stored || stored.expiresAt <= Date.now()) return null;
  return stored.accessToken;
}

export async function getYouTubeToken(): Promise<string | null> {
  const stored = await getStoredToken();
  if (stored) return stored;
  try {
    return await requestToken(false);
  } catch {
    return null;
  }
}

export async function youtubeLogout(): Promise<void> {
  const stored = await getSetting<StoredToken | null>(TOKEN_KEY, null);
  if (stored?.accessToken) window.google?.accounts.oauth2.revoke(stored.accessToken);
  await db.settings.delete(TOKEN_KEY);
}
