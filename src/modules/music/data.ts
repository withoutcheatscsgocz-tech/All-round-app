import { db } from '../../db/db';
import type { RadioStation, Track } from '../../db/types';

/** Z názvu souboru se dá většinou vyčíst „Interpret - Název". */
export function guessFromFilename(filename: string): { title: string; artist?: string } {
  const withoutExtension = filename.replace(/\.[a-z0-9]+$/i, '');
  const parts = withoutExtension.split(' - ');
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  }
  return { title: withoutExtension.trim() };
}

/** Délku zjistíme přehrávačem, ať se v seznamu nemusí hádat. */
async function readDuration(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const done = (value: number | undefined) => {
      URL.revokeObjectURL(url);
      resolve(value);
    };
    audio.addEventListener('loadedmetadata', () =>
      done(Number.isFinite(audio.duration) ? audio.duration : undefined),
    );
    audio.addEventListener('error', () => done(undefined));
    audio.preload = 'metadata';
    audio.src = url;
  });
}

export async function addTrackFile(file: File): Promise<number> {
  const guessed = guessFromFilename(file.name);
  const id = await db.tracks.add({
    title: guessed.title,
    artist: guessed.artist,
    blob: file,
    mimeType: file.type || 'audio/mpeg',
    durationSec: await readDuration(file),
    addedAt: Date.now(),
  } as Track);
  return id as number;
}

/** Náhodné pořadí (Fisher–Yates) pro tlačítko Zamíchat. */
export function shuffled<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const CZECH_RADIOS: Omit<RadioStation, 'id'>[] = [
  { name: 'ČRo Radiožurnál', streamUrl: 'https://rozhlas.stream/radiozurnal_high.mp3', genre: 'Zprávy', favorite: 1 },
  { name: 'ČRo Radio Wave', streamUrl: 'https://rozhlas.stream/wave_high.mp3', genre: 'Alternativa', favorite: 1 },
  { name: 'ČRo Vltava', streamUrl: 'https://rozhlas.stream/vltava_high.mp3', genre: 'Klasika', favorite: 0 },
  { name: 'ČRo Dvojka', streamUrl: 'https://rozhlas.stream/dvojka_high.mp3', genre: 'Mluvené slovo', favorite: 0 },
  { name: 'ČRo Jazz', streamUrl: 'https://rozhlas.stream/jazz_high.mp3', genre: 'Jazz', favorite: 0 },
  { name: 'ČRo Rádio Junior', streamUrl: 'https://rozhlas.stream/junior_high.mp3', genre: 'Pro děti', favorite: 0 },
];

export async function seedCzechRadios(): Promise<void> {
  if ((await db.radios.count()) > 0) return;
  await db.radios.bulkAdd(CZECH_RADIOS);
}
