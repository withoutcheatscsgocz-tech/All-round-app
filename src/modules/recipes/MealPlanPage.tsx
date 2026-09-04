import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { addDays, todayIso, weekdayIndex } from '../../lib/date';
import { MEAL_LABELS, MEAL_SLOTS, setMealPlan } from './data';
import type { MealSlot } from '../../db/types';

function weekStart(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function MealPlanPage() {
  const { t, lang } = useI18n();
  const [start, setStart] = useState(() => weekStart(todayIso()));
  const [picking, setPicking] = useState<{ date: string; meal: MealSlot } | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const plan = useLiveQuery(
    () => db.mealPlan.where('date').between(days[0], days[6], true, true).toArray(),
    [start],
    [],
  );
  const recipes = useLiveQuery(() => db.recipes.orderBy('title').toArray(), [], []);
  const recipeById = new Map(recipes.map((r) => [r.id!, r]));

  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
      weekday: 'short', day: 'numeric', month: 'numeric',
    }).format(new Date(iso));

  return (
    <>
      <PageHeader
        title={t('recipes.mealPlan')}
        action={<Link to="/recipes" className="text-sm text-[var(--color-accent)]">{t('common.back')}</Link>}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="subtle" onClick={() => setStart(addDays(start, -7))}>←</Button>
        <Button variant="ghost" onClick={() => setStart(weekStart(todayIso()))}>{t('common.today')}</Button>
        <Button variant="subtle" onClick={() => setStart(addDays(start, 7))}>→</Button>
      </div>

      <div className="space-y-3">
        {days.map((date) => (
          <Card key={date}>
            <p className={`mb-2 font-semibold first-letter:uppercase ${date === todayIso() ? 'text-[var(--color-accent)]' : ''}`}>
              {dayLabel(date)}
            </p>
            <div className="space-y-1.5">
              {MEAL_SLOTS.map((meal) => {
                const entry = plan.find((p) => p.date === date && p.meal === meal);
                const recipe = entry?.recipeId ? recipeById.get(entry.recipeId) : undefined;
                return (
                  <button
                    key={meal}
                    onClick={() => setPicking({ date, meal })}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-[var(--color-surface-2)]"
                  >
                    <span className="w-20 shrink-0 text-xs text-[var(--color-muted)]">
                      {t(MEAL_LABELS[meal])}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${recipe ? '' : 'text-[var(--color-muted)]'}`}>
                      {recipe?.title ?? '—'}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {picking && (
        <Sheet open onClose={() => setPicking(null)} title={t('recipes.planPick')}>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            <Button
              className="w-full"
              onClick={() => {
                void setMealPlan(picking.date, picking.meal, undefined);
                setPicking(null);
              }}
            >
              {t('recipes.planClear')}
            </Button>
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => {
                  void setMealPlan(picking.date, picking.meal, recipe.id);
                  setPicking(null);
                }}
                className="w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--color-surface-2)]"
              >
                {recipe.title}
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  );
}
