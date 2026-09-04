import { getSetting, setSetting, db } from '../../../db/db';
import {
  createPkcePair, isExpired, redirectUri, tokenSetFromResponse, type TokenSet,
} from '../../../lib/pkce';

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const CLIENT_ID_KEY = 'spotify.clientId';
const TOKENS_KEY = 'spotify.tokens';
const VERIFIER_KEY = 'spotify.verifier';
const STATE_KEY = 'spotify.state';

/**
 * `streaming` je potřeba pro Web Playback SDK na počítači, zbytek pro
 * knihovnu, vyhledávání a ovládání přehrávání přes Spotify Connect.
 */
export const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-top-read',
].join(' ');

export async function getClientId(): Promise<string> {
  return getSetting(CLIENT_ID_KEY, '');
}

export async function setClientId(id: string): Promise<void> {
  await setSetting(CLIENT_ID_KEY, id.trim());
}

export async function getTokens(): Promise<TokenSet | null> {
  return getSetting<TokenSet | null>(TOKENS_KEY, null);
}

export async function logout(): Promise<void> {
  await db.settings.delete(TOKENS_KEY);
}

/** Odešle uživatele na Spotify. Verifier zůstane v databázi na návrat zpět. */
export async function beginLogin(): Promise<void> {
  const clientId = await getClientId();
  if (!clientId) throw new Error('missing-client-id');

  const { verifier, challenge } = await createPkcePair();
  const state = crypto.randomUUID();
  await setSetting(VERIFIER_KEY, verifier);
  await setSetting(STATE_KEY, state);

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', state);

  location.assign(url.toString());
}

async function exchange(body: Record<string, string>): Promise<TokenSet> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
  if (!res.ok) {
    const detail: unknown = await res.json().catch(() => null);
    const description =
      typeof detail === 'object' && detail !== null && 'error_description' in detail
        ? String((detail as { error_description: unknown }).error_description)
        : `HTTP ${res.status}`;
    throw new Error(description);
  }
  return tokenSetFromResponse(await res.json());
}

/**
 * Zpracuje návrat z přihlášení. Volá se při startu aplikace; když v adrese
 * žádný kód není, jen se nic nestane.
 */
export async function handleRedirectCallback(): Promise<boolean> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  const returnedState = params.get('state');
  if (!code) return false;

  const clientId = await getClientId();
  const verifier = await getSetting<string>(VERIFIER_KEY, '');
  const expectedState = await getSetting<string>(STATE_KEY, '');

  // Adresu vyčistíme vždycky, ať se kód nezkouší použít podruhé.
  history.replaceState(null, '', redirectUri() + location.hash);
  await db.settings.bulkDelete([VERIFIER_KEY, STATE_KEY]);

  if (!clientId || !verifier) return false;
  if (expectedState && returnedState !== expectedState) throw new Error('state-mismatch');

  const tokens = await exchange({
    client_id: clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri(),
    code_verifier: verifier,
  });
  await setSetting(TOKENS_KEY, tokens);
  return true;
}

async function refresh(tokens: TokenSet): Promise<TokenSet | null> {
  if (!tokens.refreshToken) return null;
  const clientId = await getClientId();
  try {
    const next = await exchange({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
    });
    // Spotify nový refresh token nemusí poslat — ten starý pak platí dál.
    const merged = { ...next, refreshToken: next.refreshToken ?? tokens.refreshToken };
    await setSetting(TOKENS_KEY, merged);
    return merged;
  } catch {
    await logout();
    return null;
  }
}

/** Platný access token, případně obnovený. `null` = uživatel není přihlášený. */
export async function getAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;
  if (!isExpired(tokens)) return tokens.accessToken;
  return (await refresh(tokens))?.accessToken ?? null;
}
