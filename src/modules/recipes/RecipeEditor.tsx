import { useState } from 'react';
import { useI18n } from '../../i18n';
import { Button, Field, Input, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { formatAmount, parseIngredients } from './parse';
import { saveRecipe } from './data';
import type { Recipe } from '../../db/types';

export const EMPTY_RECIPE: Recipe = {
  title: '', portions: 4, tags: [], ingredients: [], steps: [],
  favorite: 0, createdAt: 0, updatedAt: 0,
};

function Textarea({ value, onChange, rows = 6, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 outline-none transition focus:border-[var(--color-accent)]"
    />
  );
}

export function RecipeEditor({ initial, onClose }: { initial: Recipe; onClose: () => void }) {
  const { t } = useI18n();
  const [recipe, setRecipe] = useState(initial);
  const [ingredientsText, setIngredientsText] = useState(
    initial.ingredients
      .map((i) => [formatAmount(i), i.name].filter(Boolean).join(' '))
      .join('\n'),
  );
  const [stepsText, setStepsText] = useState(initial.steps.join('\n'));
  const [tagsText, setTagsText] = useState(initial.tags.join(', '));

  const set = <K extends keyof Recipe>(key: K, value: Recipe[K]) =>
    setRecipe((prev) => ({ ...prev, [key]: value }));

  async function save() {
    await saveRecipe({
      ...recipe,
      title: recipe.title.trim(),
      ingredients: parseIngredients(ingredientsText),
      steps: stepsText.split('\n').map((s) => s.trim()).filter(Boolean),
      tags: tagsText.split(',').map((s) => s.trim()).filter(Boolean),
    });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={recipe.id ? t('recipes.editRecipe') : t('recipes.newRecipe')}>
      <div className="space-y-4">
        <Field label={t('recipes.recipeTitle')}>
          <Input value={recipe.title} onChange={(e) => set('title', e.target.value)} autoFocus />
        </Field>

        <Field label={t('recipes.description')}>
          <Textarea rows={2} value={recipe.description ?? ''} onChange={(v) => set('description', v)} />
        </Field>

        <div className="grid grid-cols-3 gap-3">
          <Field label={t('recipes.portions')}>
            <Input
              type="number" inputMode="numeric" min={1} value={recipe.portions}
              onChange={(e) => set('portions', Math.max(1, Number(e.target.value)))}
            />
          </Field>
          <Field label={t('recipes.prepTime')}>
            <Input
              type="number" inputMode="numeric" value={recipe.prepMinutes ?? ''}
              onChange={(e) => set('prepMinutes', e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>
          <Field label={t('recipes.cookTime')}>
            <Input
              type="number" inputMode="numeric" value={recipe.cookMinutes ?? ''}
              onChange={(e) => set('cookMinutes', e.target.value ? Number(e.target.value) : undefined)}
            />
          </Field>
        </div>

        <Field label={t('recipes.ingredients')}>
          <Textarea
            value={ingredientsText}
            onChange={setIngredientsText}
            placeholder={t('recipes.ingredientsHint')}
          />
        </Field>

        <Field label={t('recipes.steps')}>
          <Textarea value={stepsText} onChange={setStepsText} placeholder={t('recipes.stepsHint')} />
        </Field>

        <Field label={t('recipes.tags')}>
          <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder={t('recipes.tagsHint')} />
        </Field>

        <Field label={t('recipes.photo')}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) set('image', file);
            }}
            className="text-sm"
          />
        </Field>
      </div>

      <div className="mt-6 flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!recipe.title.trim()} onClick={() => void save()}>
          {t('common.save')}
        </Button>
        {recipe.id !== undefined && (
          <Button
            variant="danger"
            onClick={() => {
              if (confirm(t('common.confirmDelete'))) void db.recipes.delete(recipe.id!).then(onClose);
            }}
          >
            {t('common.delete')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}
