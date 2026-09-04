import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, Pill, Section, Spinner } from '../../components/ui';
import { db } from '../../db/db';
import { formatAmount } from './parse';
import { addIngredientsToShopping, portionedIngredients } from './data';
import { RecipeEditor } from './RecipeEditor';

/** Blob z databáze se musí převést na URL a po odchodu zase uvolnit. */
function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

export function RecipeDetail() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();
  const recipeId = Number(id);

  const recipe = useLiveQuery(() => db.recipes.get(recipeId), [recipeId]);
  const [portions, setPortions] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [added, setAdded] = useState(false);
  const imageUrl = useBlobUrl(recipe?.image);

  if (recipe === undefined) return <Spinner label={t('app.loading')} />;
  if (recipe === null) {
    navigate('/recipes', { replace: true });
    return null;
  }

  const shown = portions ?? recipe.portions;
  const ingredients = portionedIngredients(recipe, shown);
  const totalMinutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);

  async function addToShopping() {
    await addIngredientsToShopping(ingredients, recipe!.id);
    setAdded(true);
    setTimeout(() => setAdded(false), 2500);
  }

  return (
    <>
      <PageHeader
        title={recipe.title}
        action={
          <div className="flex shrink-0 gap-3">
            <button
              onClick={() => void db.recipes.update(recipe.id!, { favorite: recipe.favorite ? 0 : 1 })}
              className="text-xl"
              aria-label={t('recipes.favorite')}
            >
              {recipe.favorite ? '★' : '☆'}
            </button>
            <button onClick={() => setEditing(true)} className="text-xl" aria-label={t('common.edit')}>
              ✏️
            </button>
          </div>
        }
      />

      {imageUrl && (
        <img src={imageUrl} alt="" className="mb-4 max-h-56 w-full rounded-2xl object-cover" />
      )}

      {recipe.description && <p className="mb-4 text-[var(--color-muted)]">{recipe.description}</p>}

      <div className="mb-5 flex flex-wrap gap-2">
        {totalMinutes > 0 && <Pill tone="accent">⏱ {totalMinutes} {t('recipes.minutesShort')}</Pill>}
        {recipe.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}
      </div>

      <Section title={t('recipes.ingredients')}>
        <Card>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-sm text-[var(--color-muted)]">
              {t('recipes.forPortions', { count: shown })}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="subtle" className="!px-3 !py-1" onClick={() => setPortions(Math.max(1, shown - 1))}>−</Button>
              <span className="w-8 text-center font-bold tabular-nums">{shown}</span>
              <Button variant="subtle" className="!px-3 !py-1" onClick={() => setPortions(shown + 1)}>+</Button>
            </div>
          </div>

          <ul className="divide-y divide-[var(--color-border)]">
            {ingredients.map((ingredient, i) => (
              <li key={i} className="flex gap-3 py-2">
                <span className="min-w-20 shrink-0 font-medium tabular-nums">
                  {formatAmount(ingredient)}
                </span>
                <span>{ingredient.name}</span>
              </li>
            ))}
          </ul>

          {shown !== recipe.portions && (
            <p className="mt-2 text-xs text-[var(--color-muted)]">
              {t('recipes.scaled', { base: recipe.portions })}
            </p>
          )}

          <Button variant="primary" className="mt-4 w-full" onClick={() => void addToShopping()}>
            🛒 {added ? t('recipes.addedToShopping') : t('recipes.addToShopping')}
          </Button>
        </Card>
      </Section>

      {recipe.steps.length > 0 && (
        <Section title={t('recipes.steps')}>
          <Card>
            <ol className="space-y-3">
              {recipe.steps.map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-xs font-bold text-[var(--color-accent)]">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Section>
      )}

      {recipe.source && (
        <p className="mb-4 text-xs text-[var(--color-muted)]">
          {t('recipes.source')}:{' '}
          <a href={recipe.source} target="_blank" rel="noreferrer" className="underline">
            {recipe.source}
          </a>
        </p>
      )}

      {editing && <RecipeEditor initial={recipe} onClose={() => setEditing(false)} />}
    </>
  );
}
