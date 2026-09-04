/** Datum ve formátu 'YYYY-MM-DD'. */
export type IsoDate = string;
/** Čas ve formátu 'HH:MM'. */
export type ClockTime = string;

/* ------------------------------ Recepty ------------------------------ */

export interface Ingredient {
  amount?: number;
  unit?: string;
  name: string;
  /** Volitelné seskupení, např. "Těsto" / "Náplň". */
  group?: string;
}

export interface Recipe {
  id?: number;
  title: string;
  description?: string;
  portions: number;
  prepMinutes?: number;
  cookMinutes?: number;
  tags: string[];
  ingredients: Ingredient[];
  steps: string[];
  image?: Blob;
  source?: string;
  favorite: 0 | 1;
  createdAt: number;
  updatedAt: number;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealPlanEntry {
  id?: number;
  date: IsoDate;
  meal: MealSlot;
  recipeId?: number;
  /** Volný text, když to není recept z knihovny. */
  text?: string;
}

export interface ShoppingItem {
  id?: number;
  name: string;
  amount?: number;
  unit?: string;
  category?: string;
  done: 0 | 1;
  recipeId?: number;
  createdAt: number;
}

/* ------------------------------- Šichty ------------------------------ */

export interface ShiftType {
  id?: number;
  /** Krátký kód do kalendáře, např. "R", "O", "N", "D12". */
  code: string;
  name: string;
  start: ClockTime;
  end: ClockTime;
  breakMinutes: number;
  /** Placená pauza se nestrhává z odpracovaných hodin. */
  paidBreak: boolean;
  color: string;
}

export type ShiftKind = 'work' | 'off' | 'vacation' | 'sick' | 'holiday' | 'other';

export interface Shift {
  id?: number;
  date: IsoDate;
  kind: ShiftKind;
  typeId?: number;
  startOverride?: ClockTime;
  endOverride?: ClockTime;
  breakOverride?: number;
  note?: string;
}

export interface ShiftPattern {
  id?: number;
  name: string;
  /** Cyklus libovolné délky: ID typu šichty, nebo 'off' pro volno. */
  sequence: (number | 'off')[];
  anchorDate: IsoDate;
}

export interface PayConfig {
  hourlyRate: number;
  currency: string;
  nightPct: number;
  weekendPct: number;
  holidayPct: number;
  overtimePct: number;
  monthlyNormHours: number;
  netEstimate: {
    enabled: boolean;
    taxPct: number;
    socialPct: number;
    healthPct: number;
    taxCreditMonthly: number;
  };
}

/* ------------------------------- Hudba ------------------------------- */

export interface Track {
  id?: number;
  title: string;
  artist?: string;
  album?: string;
  durationSec?: number;
  blob: Blob;
  mimeType: string;
  addedAt: number;
}

export interface Playlist {
  id?: number;
  name: string;
  trackIds: number[];
  createdAt: number;
}

export interface RadioStation {
  id?: number;
  name: string;
  streamUrl: string;
  genre?: string;
  favorite: 0 | 1;
}

export interface MediaLink {
  id?: number;
  kind: 'youtube' | 'spotify';
  /** Video / playlist / album / track ID podle služby. */
  refType: string;
  refId: string;
  title: string;
  thumb?: string;
  addedAt: number;
}

/* -------------------------- Filmy a seriály -------------------------- */

export interface WatchProvider {
  name: string;
  logo?: string;
  link?: string;
}

export interface WatchItem {
  id?: number;
  kind: 'movie' | 'tv';
  tmdbId: number;
  title: string;
  year?: number;
  poster?: string;
  overview?: string;
  rating?: number;
  status: 'watchlist' | 'watching' | 'done';
  providers?: WatchProvider[];
  providersFetchedAt?: number;
  addedAt: number;
}

export interface WatchProgress {
  id?: number;
  itemId: number;
  season: number;
  episode: number;
  watchedAt: number;
}

/* ------------------------------ Doprava ------------------------------ */

export interface FavouriteStop {
  id?: number;
  stopId: string;
  name: string;
  lat?: number;
  lon?: number;
  order: number;
}

export interface SavedRoute {
  id?: number;
  name: string;
  fromName: string;
  fromLat: number;
  fromLon: number;
  toName: string;
  toLat: number;
  toLon: number;
  /** Použít pro výpočet "kdy vyjet" k začátku šichty. */
  isCommute: boolean;
}

/* --------------------- Poznámky, výdaje, kalendář -------------------- */

export interface Note {
  id?: number;
  title: string;
  body: string;
  tags: string[];
  /** Úkol má termín a dá se odškrtnout; poznámka ne. */
  isTask: 0 | 1;
  done: 0 | 1;
  due?: IsoDate;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id?: number;
  date: IsoDate;
  amount: number;
  category: string;
  note?: string;
  method?: string;
}

export interface Budget {
  /** 'YYYY-MM' */
  month: string;
  id?: number;
  limits: Record<string, number>;
}

export interface CalendarEvent {
  id?: number;
  date: IsoDate;
  endDate?: IsoDate;
  start?: ClockTime;
  end?: ClockTime;
  title: string;
  note?: string;
  color?: string;
  remindMinutesBefore?: number;
}

/* ----------------------------- Nastavení ----------------------------- */

export interface SettingRow<T = unknown> {
  key: string;
  value: T;
}

export interface CacheRow<T = unknown> {
  key: string;
  value: T;
  expiresAt: number;
}
