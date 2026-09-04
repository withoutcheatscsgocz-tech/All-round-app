import { db } from '../../db/db';
import type { Ingredient, MealSlot, Recipe } from '../../db/types';
import { mergeShoppingItems, scaleIngredients } from './parse';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS = {
  breakfast: 'recipes.mealBreakfast',
  lunch: 'recipes.mealLunch',
  dinner: 'recipes.mealDinner',
  snack: 'recipes.mealSnack',
} as const;

export async function saveRecipe(recipe: Recipe): Promise<number> {
  const now = Date.now();
  const id = await db.recipes.put({
    ...recipe,
    createdAt: recipe.createdAt || now,
    updatedAt: now,
  });
  return id as number;
}

/** Přidá suroviny na nákupní seznam a rovnou je sloučí s tím, co tam už je. */
export async function addIngredientsToShopping(
  ingredients: Ingredient[],
  recipeId?: number,
): Promise<number> {
  const merged = mergeShoppingItems(ingredients);
  const existing = await db.shoppingItems.filter((i) => i.done === 0).toArray();

  let added = 0;
  for (const item of merged) {
    const match = existing.find(
      (e) =>
        e.name.toLowerCase() === item.name.toLowerCase() &&
        (e.unit ?? '').toLowerCase() === (item.unit ?? '').toLowerCase(),
    );

    if (match?.id !== undefined && match.amount !== undefined && item.amount !== undefined) {
      await db.shoppingItems.update(match.id, { amount: match.amount + item.amount });
    } else {
      await db.shoppingItems.add({
        name: item.name,
        amount: item.amount,
        unit: item.unit,
        done: 0,
        recipeId,
        createdAt: Date.now(),
      });
    }
    added += 1;
  }
  return added;
}

/** Suroviny receptu přepočítané na zvolený počet porcí. */
export function portionedIngredients(recipe: Recipe, portions: number): Ingredient[] {
  return scaleIngredients(recipe.ingredients, recipe.portions, portions);
}

export async function setMealPlan(
  date: string,
  meal: MealSlot,
  recipeId: number | undefined,
): Promise<void> {
  const existing = await db.mealPlan.where('[date+meal]').equals([date, meal]).first();
  if (recipeId === undefined) {
    if (existing?.id !== undefined) await db.mealPlan.delete(existing.id);
    return;
  }
  await db.mealPlan.put(existing?.id ? { ...existing, recipeId } : { date, meal, recipeId });
}
