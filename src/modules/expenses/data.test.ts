import { describe, expect, it } from 'vitest';
import { summariseByCategory, totalSpent } from './data';
import type { Expense } from '../../db/types';

const expense = (category: string, amount: number): Expense => ({
  date: '2026-09-04', amount, category,
});

describe('summariseByCategory', () => {
  it('sečte kategorie a seřadí od nejdražší', () => {
    const rows = summariseByCategory([
      expense('food', 250),
      expense('transport', 800),
      expense('food', 150),
    ]);
    expect(rows.map((r) => r.category)).toEqual(['transport', 'food']);
    expect(rows[0].total).toBe(800);
    expect(rows[1].total).toBe(400);
  });

  it('podíl se počítá vůči největší kategorii, ať jsou sloupce srovnatelné', () => {
    const rows = summariseByCategory([expense('a', 100), expense('b', 25)]);
    expect(rows[0].share).toBe(1);
    expect(rows[1].share).toBe(0.25);
  });

  it('pozná přečerpaný rozpočet', () => {
    const rows = summariseByCategory(
      [expense('food', 3000), expense('fun', 500)],
      { food: 2500, fun: 1000 },
    );
    expect(rows[0].overBudget).toBe(true);
    expect(rows[1].overBudget).toBe(false);
  });

  it('prázdný měsíc nedělí nulou', () => {
    expect(summariseByCategory([])).toEqual([]);
    expect(totalSpent([])).toBe(0);
  });
});
