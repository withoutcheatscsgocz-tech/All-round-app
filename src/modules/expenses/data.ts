import type { Expense } from '../../db/types';
import { round2 } from '../../lib/date';

export const CATEGORY_KEYS = [
  'food', 'transport', 'home', 'fun', 'health', 'clothes', 'other',
] as const;

export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const CATEGORY_LABELS = {
  food: 'expenses.catFood',
  transport: 'expenses.catTransport',
  home: 'expenses.catHome',
  fun: 'expenses.catFun',
  health: 'expenses.catHealth',
  clothes: 'expenses.catClothes',
  other: 'expenses.catOther',
} as const;

export const CATEGORY_ICONS: Record<CategoryKey, string> = {
  food: '🍔', transport: '🚌', home: '🏠', fun: '🎉',
  health: '💊', clothes: '👕', other: '📦',
};

export interface CategoryTotal {
  category: string;
  total: number;
  /** Podíl na největší kategorii — z toho se kreslí délka sloupce. */
  share: number;
  budget?: number;
  overBudget: boolean;
}

/** Součty po kategoriích, seřazené od nejdražší. */
export function summariseByCategory(
  expenses: Expense[],
  budgets: Record<string, number> = {},
): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }

  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 0;

  return rows.map(([category, total]) => {
    const budget = budgets[category];
    return {
      category,
      total: round2(total),
      share: max > 0 ? total / max : 0,
      budget,
      overBudget: budget !== undefined && total > budget,
    };
  });
}

export function totalSpent(expenses: Expense[]): number {
  return round2(expenses.reduce((sum, e) => sum + e.amount, 0));
}
