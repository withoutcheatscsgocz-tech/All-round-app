import type { Ingredient, Recipe } from '../../db/types';

/* ------------------------- ingredience z textu ------------------------ */

const UNITS = [
  'kg', 'g', 'dkg', 'mg', 'l', 'dl', 'ml', 'cl',
  'lžíce', 'lžíc', 'lžíci', 'lžička', 'lžičky', 'lžiček', 'lžičku',
  'ks', 'kus', 'kusy', 'kusů', 'balení', 'plátek', 'plátky', 'plátků',
  'hrnek', 'hrnky', 'hrnků', 'špetka', 'špetku', 'stroužek', 'stroužky', 'svazek',
  'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb',
];

const UNIT_PATTERN = UNITS.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

/** Zlomky, které lidi v receptech píšou. */
const FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅛': 0.125,
};

export function parseAmount(raw: string): number | undefined {
  const text = raw.trim().replace(',', '.');
  if (!text) return undefined;

  if (text in FRACTIONS) return FRACTIONS[text];

  // Tvary jako "1½" nebo "1 1/2".
  const mixed = /^(\d+)\s*([½⅓⅔¼¾⅕⅛])$/.exec(text);
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]];

  const slash = /^(\d+)\s+(\d+)\/(\d+)$/.exec(text);
  if (slash) return Number(slash[1]) + Number(slash[2]) / Number(slash[3]);

  const simpleFraction = /^(\d+)\/(\d+)$/.exec(text);
  if (simpleFraction) return Number(simpleFraction[1]) / Number(simpleFraction[2]);

  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : undefined;
}

/**
 * Rozebere řádek typu „250 g hladké mouky" na množství, jednotku a název.
 * Když to nejde, zůstane celý řádek jako název — nic se neztratí.
 */
export function parseIngredient(line: string): Ingredient | null {
  const text = line.replace(/^[-–—*•\s]+/, '').trim();
  if (!text) return null;

  const pattern = new RegExp(
    `^(\\d+[.,]?\\d*(?:\\s+\\d+\\/\\d+)?|\\d*\\s*[½⅓⅔¼¾⅕⅛]|\\d+\\/\\d+)\\s*(${UNIT_PATTERN})?\\.?\\s+(.+)$`,
    'i',
  );
  const match = pattern.exec(text);
  if (!match) return { name: text };

  const amount = parseAmount(match[1]);
  if (amount === undefined) return { name: text };

  return {
    amount,
    unit: match[2]?.toLowerCase(),
    name: match[3].trim(),
  };
}

export function parseIngredients(block: string): Ingredient[] {
  return block
    .split('\n')
    .map(parseIngredient)
    .filter((i): i is Ingredient => i !== null);
}

/* --------------------------- přepočet porcí -------------------------- */

/** Zaokrouhlí na to, co se dá reálně odvážit — 83,3333 g nikdo neváží. */
function tidy(value: number): number {
  if (value >= 10) return Math.round(value);
  if (value >= 1) return Math.round(value * 10) / 10;
  return Math.round(value * 100) / 100;
}

export function scaleIngredients(
  ingredients: Ingredient[],
  fromPortions: number,
  toPortions: number,
): Ingredient[] {
  if (fromPortions <= 0 || toPortions <= 0 || fromPortions === toPortions) return ingredients;
  const factor = toPortions / fromPortions;
  return ingredients.map((i) =>
    i.amount === undefined ? i : { ...i, amount: tidy(i.amount * factor) },
  );
}

export function formatAmount(ingredient: Ingredient): string {
  if (ingredient.amount === undefined) return '';
  const amount = Number.isInteger(ingredient.amount)
    ? String(ingredient.amount)
    : String(ingredient.amount).replace('.', ',');
  return ingredient.unit ? `${amount} ${ingredient.unit}` : amount;
}

/* ------------------------- nákupní seznam ---------------------------- */

export interface MergedItem {
  name: string;
  unit?: string;
  amount?: number;
  /** Kolikrát se surovina objevila bez uvedeného množství. */
  countWithoutAmount: number;
}

/**
 * Sloučí stejné suroviny se stejnou jednotkou do jedné položky.
 * Různé jednotky se nepřevádějí — 2 lžíce a 30 g oleje zůstanou zvlášť,
 * protože přepočet by byl jen hádání.
 */
export function mergeShoppingItems(ingredients: Ingredient[]): MergedItem[] {
  const map = new Map<string, MergedItem>();

  for (const ingredient of ingredients) {
    const name = ingredient.name.trim();
    if (!name) continue;
    const key = `${name.toLowerCase()}|${ingredient.unit?.toLowerCase() ?? ''}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        name,
        unit: ingredient.unit,
        amount: ingredient.amount,
        countWithoutAmount: ingredient.amount === undefined ? 1 : 0,
      });
      continue;
    }

    if (ingredient.amount === undefined) {
      existing.countWithoutAmount += 1;
    } else {
      existing.amount = tidy((existing.amount ?? 0) + ingredient.amount);
    }
  }

  return [...map.values()];
}

/* ----------------------- import z webové stránky --------------------- */

interface JsonLdRecipe {
  '@type'?: string | string[];
  name?: string;
  description?: string;
  recipeYield?: string | number | (string | number)[];
  recipeIngredient?: string[];
  ingredients?: string[];
  recipeInstructions?: unknown;
  prepTime?: string;
  cookTime?: string;
  keywords?: string | string[];
}

function isRecipeNode(node: unknown): node is JsonLdRecipe {
  if (typeof node !== 'object' || node === null) return false;
  const type = (node as JsonLdRecipe)['@type'];
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === 'string' && t.toLowerCase() === 'recipe');
}

/** Projde i @graph a vnořená pole, protože weby to strukturují všelijak. */
function findRecipeNode(value: unknown, depth = 0): JsonLdRecipe | null {
  if (depth > 6 || value === null || typeof value !== 'object') return null;
  if (isRecipeNode(value)) return value;

  const values = Array.isArray(value) ? value : Object.values(value as Record<string, unknown>);
  for (const child of values) {
    const found = findRecipeNode(child, depth + 1);
    if (found) return found;
  }
  return null;
}

/** ISO 8601 trvání (PT1H30M) na minuty. */
export function parseIsoDuration(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/.exec(value.trim());
  if (!match) return undefined;
  const [, days, hours, minutes] = match;
  const total = Number(days ?? 0) * 1440 + Number(hours ?? 0) * 60 + Number(minutes ?? 0);
  return total > 0 ? total : undefined;
}

function flattenInstructions(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === 'string') {
    return value
      .split(/\n|(?<=\.)\s{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(value)) return value.flatMap((v) => flattenInstructions(v, depth + 1));
  if (typeof value === 'object' && value !== null) {
    const node = value as { text?: unknown; name?: unknown; itemListElement?: unknown };
    if (node.itemListElement) return flattenInstructions(node.itemListElement, depth + 1);
    if (typeof node.text === 'string') return [node.text.trim()];
    if (typeof node.name === 'string') return [node.name.trim()];
  }
  return [];
}

function parseYield(value: JsonLdRecipe['recipeYield']): number {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first === 'number') return first;
  if (typeof first === 'string') {
    const match = /\d+/.exec(first);
    if (match) return Number(match[0]);
  }
  return 4;
}

export type ImportedRecipe = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'image'>;

/**
 * Vytáhne recept ze schema.org JSON-LD, které má na stránce skoro každý
 * receptový web. Funguje jak na celém HTML, tak na samotném JSON.
 */
export function parseRecipeFromHtml(html: string, source?: string): ImportedRecipe | null {
  const blocks: string[] = [];

  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) blocks.push(match[1]);
  if (blocks.length === 0) blocks.push(html);

  for (const block of blocks) {
    let data: unknown;
    try {
      data = JSON.parse(block.trim());
    } catch {
      continue;
    }
    const node = findRecipeNode(data);
    if (!node?.name) continue;

    const rawIngredients = node.recipeIngredient ?? node.ingredients ?? [];
    const keywords = typeof node.keywords === 'string'
      ? node.keywords.split(',').map((k) => k.trim()).filter(Boolean)
      : Array.isArray(node.keywords) ? node.keywords : [];

    return {
      title: node.name.trim(),
      description: typeof node.description === 'string' ? node.description.trim() : undefined,
      portions: parseYield(node.recipeYield),
      prepMinutes: parseIsoDuration(node.prepTime),
      cookMinutes: parseIsoDuration(node.cookTime),
      tags: keywords.slice(0, 8),
      ingredients: rawIngredients
        .map((line) => parseIngredient(String(line)))
        .filter((i): i is Ingredient => i !== null),
      steps: flattenInstructions(node.recipeInstructions),
      source,
      favorite: 0,
    };
  }

  return null;
}
