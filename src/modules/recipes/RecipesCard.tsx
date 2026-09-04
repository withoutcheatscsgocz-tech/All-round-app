import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card } from '../../components/ui';
import { todayIso } from '../../lib/date';
import { MEAL_LABELS, MEAL_SLOTS } from './data';

export function RecipesCard() {
  const { t } = useI18n();
  const today = todayIso();

  const plan = useLiveQuery(() => db.mealPlan.where('date').equals(today).toArray(), [today], []);
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], []);
  const shoppingOpen = useLiveQuery(() => db.shoppingItems.where('done').equals(0).count(), [], 0);

  const byId = new Map(recipes.map((r) => [r.id!, r]));
  const planned = MEAL_SLOTS
    .map((meal) => ({ meal, entry: plan.find((p) => p.meal === meal) }))
    .filter((row) => row.entry?.recipeId !== undefined);

  if (planned.length === 0 && shoppingOpen === 0) return null;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">🍳 {t('recipes.todayMeal')}</h3>
        <Link to="/recipes" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>

      {planned.map(({ meal, entry }) => {
        const recipe = byId.get(entry!.recipeId!);
        return (
          <Link
            key={meal}
            to={recipe ? `/recipes/${recipe.id}` : '/recipes'}
            className="flex items-center justify-between gap-3 py-1.5"
          >
            <span className="text-sm text-[var(--color-muted)]">{t(MEAL_LABELS[meal])}</span>
            <span className="min-w-0 truncate font-medium">{recipe?.title ?? '—'}</span>
          </Link>
        );
      })}

      {shoppingOpen > 0 && (
        <Link
          to="/recipes/shopping"
          className="mt-2 block border-t border-[var(--color-border)] pt-2 text-sm text-[var(--color-muted)]"
        >
          🛒 {t('recipes.shopping')}: {shoppingOpen}
        </Link>
      )}
    </Card>
  );
}
