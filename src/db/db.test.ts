import { describe, expect, it } from 'vitest';
import { AllRoundDB } from './db';

/**
 * Dexie umí řadit jen podle indexovaného klíče — `orderBy` na neindexovaném
 * poli spadne až v prohlížeči na SchemaError a shodí celou obrazovku.
 * Tenhle test projde všechna řazení a filtry, které appka opravdu používá.
 */
async function freshDb(name: string) {
  const db = new AllRoundDB(name);
  await db.open();
  return db;
}

describe('schéma databáze', () => {
  it('podporuje všechna řazení, která moduly používají', async () => {
    const db = await freshDb(`test-orderby-${Math.random()}`);
    try {
      await expect(db.notes.orderBy('updatedAt').reverse().toArray()).resolves.toEqual([]);
      await expect(db.recipes.orderBy('updatedAt').reverse().toArray()).resolves.toEqual([]);
      await expect(db.recipes.orderBy('title').toArray()).resolves.toEqual([]);
      await expect(db.tracks.orderBy('title').toArray()).resolves.toEqual([]);
      await expect(db.favStops.orderBy('order').toArray()).resolves.toEqual([]);
      await expect(db.shiftTypes.orderBy('code').toArray()).resolves.toEqual([]);
    } finally {
      db.close();
    }
  });

  it('podporuje všechny dotazy where, které moduly používají', async () => {
    const db = await freshDb(`test-where-${Math.random()}`);
    try {
      await expect(db.shifts.where('date').between('2026-09-00', '2026-09-99').toArray()).resolves.toEqual([]);
      await expect(db.expenses.where('date').between('2026-09-00', '2026-09-99').toArray()).resolves.toEqual([]);
      await expect(db.budgets.where('month').equals('2026-09').first()).resolves.toBeUndefined();
      await expect(db.mealPlan.where('[date+meal]').equals(['2026-09-04', 'lunch']).first()).resolves.toBeUndefined();
      await expect(db.shoppingItems.where('done').equals(0).count()).resolves.toBe(0);
      await expect(db.mediaLinks.where('kind').equals('youtube').toArray()).resolves.toEqual([]);
      await expect(db.watchItems.where('[kind+tmdbId]').equals(['tv', 1]).first()).resolves.toBeUndefined();
      await expect(db.watchItems.where('status').equals('watching').sortBy('addedAt')).resolves.toEqual([]);
      await expect(db.watchProgress.where('itemId').equals(1).toArray()).resolves.toEqual([]);
      await expect(db.cache.where('expiresAt').below(Date.now()).toArray()).resolves.toEqual([]);
      await expect(db.events.where('date').between('2026-09-00', '2026-09-99').toArray()).resolves.toEqual([]);
    } finally {
      db.close();
    }
  });

  it('jeden den má jen jednu šichtu a jedna zastávka jen jeden záznam', async () => {
    const db = await freshDb(`test-unique-${Math.random()}`);
    try {
      await db.shifts.add({ date: '2026-09-04', kind: 'work' });
      await expect(db.shifts.add({ date: '2026-09-04', kind: 'off' })).rejects.toThrow();

      await db.favStops.add({ stopId: 'cz-1', name: 'Zastávka', order: 0 });
      await expect(db.favStops.add({ stopId: 'cz-1', name: 'Duplikát', order: 1 })).rejects.toThrow();
    } finally {
      db.close();
    }
  });
});
