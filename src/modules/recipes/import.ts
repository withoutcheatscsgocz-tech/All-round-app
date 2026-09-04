import { parseRecipeFromHtml, type ImportedRecipe } from './parse';

/**
 * Statická appka nemůže kvůli CORS načíst cizí stránku napřímo, takže se
 * zkusí obojí: přímé stažení a veřejná čtecí proxy. Když neprojde ani jedno,
 * uživatel vloží text stránky ručně — parser je pro všechny cesty stejný.
 */
const READER_PROXY = 'https://r.jina.ai/';
const TIMEOUT_MS = 20_000;

export class ImportBlockedError extends Error {}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  const clean = url.trim();
  if (!/^https?:\/\//i.test(clean)) throw new Error('URL musí začínat http(s)://');

  for (const candidate of [clean, READER_PROXY + clean]) {
    let html: string;
    try {
      html = await fetchText(candidate);
    } catch {
      continue;
    }
    const recipe = parseRecipeFromHtml(html, clean);
    if (recipe) return recipe;
  }

  throw new ImportBlockedError('blocked');
}

export function importRecipeFromText(text: string, source?: string): ImportedRecipe {
  const recipe = parseRecipeFromHtml(text, source);
  if (!recipe) throw new Error('failed');
  return recipe;
}
