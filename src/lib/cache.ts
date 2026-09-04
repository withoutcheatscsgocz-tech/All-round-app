import { db } from '../db/db';

/**
 * Odpovědi z internetu se ukládají do IndexedDB, aby appka po otevření
 * hned něco ukázala i bez signálu.
 */
export async function cached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = await db.cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  try {
    const value = await fetcher();
    await db.cache.put({ key, value, expiresAt: now + ttlMs });
    return value;
  } catch (err) {
    // Radši prošlá data než prázdná obrazovka, když zrovna není signál.
    if (hit) return hit.value as T;
    throw err;
  }
}

export async function clearExpiredCache(): Promise<void> {
  await db.cache.where('expiresAt').below(Date.now()).delete();
}
