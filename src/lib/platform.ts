import { Capacitor } from '@capacitor/core';

/** Běží appka jako nainstalované APK, nebo v prohlížeči? */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/**
 * Vlastní schéma pro návrat z přihlášení. Uvnitř APK je origin
 * `https://localhost`, který Spotify jako redirect URI nebere — vlastní
 * schéma ale podporuje.
 */
export const NATIVE_SCHEME = 'cz.allround.app';
export const NATIVE_REDIRECT = `${NATIVE_SCHEME}://callback`;
