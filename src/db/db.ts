import Dexie, { type EntityTable } from 'dexie';
import type {
  Budget, CacheRow, CalendarEvent, Expense, FavouriteStop, MealPlanEntry, MediaLink,
  Note, Playlist, RadioStation, Recipe, SavedRoute, SettingRow, Shift, ShiftPattern,
  ShiftType, ShoppingItem, Track, WatchItem, WatchProgress,
} from './types';

export class AllRoundDB extends Dexie {
  recipes!: EntityTable<Recipe, 'id'>;
  mealPlan!: EntityTable<MealPlanEntry, 'id'>;
  shoppingItems!: EntityTable<ShoppingItem, 'id'>;
  shiftTypes!: EntityTable<ShiftType, 'id'>;
  shifts!: EntityTable<Shift, 'id'>;
  shiftPatterns!: EntityTable<ShiftPattern, 'id'>;
  tracks!: EntityTable<Track, 'id'>;
  playlists!: EntityTable<Playlist, 'id'>;
  radios!: EntityTable<RadioStation, 'id'>;
  mediaLinks!: EntityTable<MediaLink, 'id'>;
  watchItems!: EntityTable<WatchItem, 'id'>;
  watchProgress!: EntityTable<WatchProgress, 'id'>;
  favStops!: EntityTable<FavouriteStop, 'id'>;
  savedRoutes!: EntityTable<SavedRoute, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  expenses!: EntityTable<Expense, 'id'>;
  budgets!: EntityTable<Budget, 'id'>;
  events!: EntityTable<CalendarEvent, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  cache!: EntityTable<CacheRow, 'key'>;

  constructor(name = 'all-round-app') {
    super(name);
    this.version(1).stores({
      recipes: '++id, title, *tags, favorite, updatedAt',
      mealPlan: '++id, date, [date+meal]',
      shoppingItems: '++id, done, category',
      shiftTypes: '++id, code',
      shifts: '++id, &date',
      shiftPatterns: '++id, name',
      tracks: '++id, title, artist',
      playlists: '++id, name',
      radios: '++id, name, favorite',
      mediaLinks: '++id, kind',
      watchItems: '++id, [kind+tmdbId], status',
      watchProgress: '++id, itemId, [itemId+season+episode]',
      favStops: '++id, &stopId, order',
      savedRoutes: '++id, name, isCommute',
      notes: '++id, isTask, done, due, updatedAt, *tags',
      expenses: '++id, date, category',
      budgets: '++id, &month',
      events: '++id, date',
      settings: '&key',
      cache: '&key, expiresAt',
    });
  }
}

export const db = new AllRoundDB();

/** Přečte nastavení, nebo vrátí výchozí hodnotu, když ještě neexistuje. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row === undefined ? fallback : (row.value as T);
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}

/** Vyžádá si trvalé úložiště, aby prohlížeč nevyhodil nahranou hudbu a fotky. */
export async function requestPersistentStorage(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
