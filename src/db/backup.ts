import { db } from './db';

const BACKUP_FORMAT = 'all-round-app-backup';
const BACKUP_VERSION = 1;

/** Tabulky, které se zálohují jako čistý JSON (bez binárních dat). */
const JSON_TABLES = [
  'mealPlan', 'shoppingItems', 'shiftTypes', 'shifts', 'shiftPatterns',
  'playlists', 'radios', 'mediaLinks', 'watchItems', 'watchProgress',
  'favStops', 'savedRoutes', 'notes', 'expenses', 'budgets', 'events', 'settings',
] as const;

interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  tables: Record<string, unknown[]>;
  /** Recepty se ukládají zvlášť, protože fotka je Blob → base64. */
  recipes: unknown[];
  /** Nahraná hudba se do zálohy nedává — byly by to stovky MB v JSONu. */
  skipped: string[];
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  return res.blob();
}

export async function exportBackup(): Promise<Blob> {
  const tables: Record<string, unknown[]> = {};
  for (const name of JSON_TABLES) {
    tables[name] = await db.table(name).toArray();
  }

  const recipes = await Promise.all(
    (await db.recipes.toArray()).map(async (r) => ({
      ...r,
      image: r.image ? await blobToDataUrl(r.image) : undefined,
    })),
  );

  const payload: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    tables,
    recipes,
    skipped: ['tracks'],
  };

  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export function downloadBackup(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all-round-zaloha-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(file: File): Promise<void> {
  const parsed: unknown = JSON.parse(await file.text());
  if (
    typeof parsed !== 'object' || parsed === null ||
    (parsed as BackupFile).format !== BACKUP_FORMAT
  ) {
    throw new Error('Tenhle soubor není záloha All-round appky.');
  }
  const backup = parsed as BackupFile;

  const recipes = await Promise.all(
    (backup.recipes ?? []).map(async (raw) => {
      const r = raw as Record<string, unknown>;
      const image = typeof r.image === 'string' ? await dataUrlToBlob(r.image) : undefined;
      return { ...r, image };
    }),
  );

  await db.transaction('rw', db.tables, async () => {
    for (const name of JSON_TABLES) {
      const rows = backup.tables?.[name];
      if (!Array.isArray(rows)) continue;
      await db.table(name).clear();
      await db.table(name).bulkPut(rows);
    }
    await db.recipes.clear();
    if (recipes.length) await db.recipes.bulkPut(recipes as never);
  });
}
