import { isNativeApp, NATIVE_REDIRECT } from './platform';

/**
 * PKCE (RFC 7636) pro přihlášení bez serveru. Klientská aplikace nemůže
 * bezpečně držet client secret, proto se místo něj posílá jednorázová
 * dvojice verifier/challenge — a secret není potřeba vůbec.
 */

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function randomString(length = 64): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CHARS[b % CHARS.length]).join('');
}

/** base64url bez zarovnávacích rovnítek, jak vyžaduje specifikace. */
export function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function challengeFromVerifier(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64UrlEncode(digest);
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifier = randomString(64);
  return { verifier, challenge: await challengeFromVerifier(verifier) };
}

export function buildAuthUrl(
  endpoint: string,
  params: Record<string, string>,
): string {
  const url = new URL(endpoint);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

/**
 * Návratová adresa aplikace. Ve webu se používá HashRouter, takže se
 * poskytovateli dává čistá cesta bez hashe a parametry se čtou z query
 * stringu. V APK je origin `https://localhost`, který poskytovatelé jako
 * redirect URI neberou — tam se proto vrací vlastní schéma a odpověď
 * odchytává systém.
 */
export function redirectUri(): string {
  if (isNativeApp()) return NATIVE_REDIRECT;
  return `${location.origin}${location.pathname}`;
}

export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Unixový čas v milisekundách. */
  expiresAt: number;
  scope?: string;
}

export function tokenSetFromResponse(data: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}): TokenSet {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Minuta rezervy, ať token nevyprší zrovna během požadavku.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    scope: data.scope,
  };
}

export function isExpired(tokens: TokenSet | null): boolean {
  return !tokens || tokens.expiresAt <= Date.now();
}
