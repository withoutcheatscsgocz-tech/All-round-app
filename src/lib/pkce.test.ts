import { describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import {
  base64UrlEncode, buildAuthUrl, challengeFromVerifier, createPkcePair,
  isExpired, randomString, tokenSetFromResponse,
} from './pkce';

vi.stubGlobal('crypto', webcrypto);
vi.stubGlobal('btoa', (s: string) => Buffer.from(s, 'binary').toString('base64'));

describe('PKCE', () => {
  it('verifier má povolenou délku i znaky (RFC 7636)', () => {
    const verifier = randomString(64);
    expect(verifier).toHaveLength(64);
    expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    expect(randomString(64)).not.toBe(verifier);
  });

  it('base64url nemá +, / ani =', () => {
    const encoded = base64UrlEncode(new Uint8Array([251, 255, 254, 0, 1]).buffer);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('challenge je SHA-256 z verifieru podle příkladu ve specifikaci', async () => {
    // RFC 7636, příloha B.
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(await challengeFromVerifier(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('dvojice verifier/challenge spolu sedí', async () => {
    const pair = await createPkcePair();
    expect(await challengeFromVerifier(pair.verifier)).toBe(pair.challenge);
  });
});

describe('buildAuthUrl', () => {
  it('poskládá adresu s parametry', () => {
    const url = buildAuthUrl('https://accounts.spotify.com/authorize', {
      client_id: 'abc', response_type: 'code', scope: 'streaming user-read-email',
    });
    expect(url).toContain('client_id=abc');
    expect(url).toContain('scope=streaming+user-read-email');
  });
});

describe('tokeny', () => {
  it('platnost počítá s minutovou rezervou', () => {
    const before = Date.now();
    const tokens = tokenSetFromResponse({ access_token: 'x', expires_in: 3600 });
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3540 * 1000);
    expect(tokens.expiresAt).toBeLessThanOrEqual(Date.now() + 3540 * 1000);
  });

  it('pozná vypršený i chybějící token', () => {
    expect(isExpired(null)).toBe(true);
    expect(isExpired({ accessToken: 'x', expiresAt: Date.now() - 1 })).toBe(true);
    expect(isExpired({ accessToken: 'x', expiresAt: Date.now() + 60_000 })).toBe(false);
  });
});
