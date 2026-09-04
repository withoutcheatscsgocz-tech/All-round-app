import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Input, Pill } from '../../components/ui';
import { db } from '../../db/db';
import { EMPTY_RECIPE, RecipeEditor } from './RecipeEditor';
import { ImportSheet } from './ImportSheet';
import type { Recipe } from '../../db/types';

function RecipeRow({ recipe }: { recipe: Recipe }) {
  const { t } = useI18n();
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  return (
    <Link to={`/recipes/${recipe.id}`} className="block">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">
              {recipe.favorite ? '★ ' : ''}{recipe.title}
            </p>
            {recipe.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-muted)]">
                {recipe.description}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {minutes > 0 && <Pill tone="accent">⏱ {minutes} {t('recipes.minutesShort')}</Pill>}
              {recipe.tags.slice(0, 3).map((tag) => <Pill key={tag}>{tag}</Pill>)}
            </div>
          </div>
          <span className="shrink-0 text-sm text-[var(--color-muted)]">
            {recipe.portions} 🍽
          </span>
        </div>
      </Card>
    </Link>
  );
}

export function RecipesPage() {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [importing, setImporting] = useState(false);

  const recipes = useLiveQuery(() => db.recipes.orderBy('updatedAt').reverse().toArray(), [], []);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const recipe of recipes) {
      for (const tag of recipe.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name]) => name);
  }, [recipes]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes.filter((recipe) => {
      if (tag && !recipe.tags.includes(tag)) return false;
      if (!needle) return true;
      return (
        recipe.title.toLowerCase().includes(needle) ||
        recipe.ingredients.some((i) => i.name.toLowerCase().includes(needle))
      );
    });
  }, [recipes, query, tag]);

  return (
    <>
      <PageHeader
        title={t('recipes.title')}
        action={
          <div className="flex shrink-0 gap-3">
            <Link to="/recipes/shopping" className="text-xl" aria-label={t('recipes.shopping')}>🛒</Link>
            <Link to="/recipes/plan" className="text-xl" aria-label={t('recipes.mealPlan')}>📆</Link>
          </div>
        }
      />

      <div className="mb-4 flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('recipes.searchRecipes')}
        />
        <Button variant="primary" onClick={() => setEditing({ ...EMPTY_RECIPE })} aria-label={t('recipes.newRecipe')}>
          +
        </Button>
      </div>

      {tags.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setTag(null)}
            className={`rounded-full px-3 py-1 text-xs transition ${
              tag === null ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
            }`}
          >
            {t('common.all')}
          </button>
          {tags.map((name) => (
            <button
              key={name}
              onClick={() => setTag(name === tag ? null : name)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                tag === name ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          title={recipes.length === 0 ? t('recipes.noRecipes') : t('common.none')}
          action={
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => setEditing({ ...EMPTY_RECIPE })}>
                + {t('recipes.newRecipe')}
              </Button>
              <Button onClick={() => setImporting(true)}>🌐 {t('recipes.import')}</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((recipe) => <RecipeRow key={recipe.id} recipe={recipe} />)}
        </div>
      )}

      {filtered.length > 0 && (
        <Button className="mt-4 w-full" onClick={() => setImporting(true)}>
          🌐 {t('recipes.import')}
        </Button>
      )}

      {editing && <RecipeEditor initial={editing} onClose={() => setEditing(null)} />}
      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </>
  );
}
