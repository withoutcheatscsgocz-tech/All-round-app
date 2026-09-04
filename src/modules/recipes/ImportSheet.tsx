import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { Button, Field, Input, Sheet } from '../../components/ui';
import { importRecipeFromText, importRecipeFromUrl, ImportBlockedError } from './import';
import { saveRecipe } from './data';

export function ImportSheet({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function store(recipe: Awaited<ReturnType<typeof importRecipeFromUrl>>) {
    const id = await saveRecipe({ ...recipe, createdAt: 0, updatedAt: 0 });
    onClose();
    navigate(`/recipes/${id}`);
  }

  async function fromUrl() {
    setBusy(true);
    setError(null);
    try {
      await store(await importRecipeFromUrl(url));
    } catch (err) {
      setError(err instanceof ImportBlockedError ? t('recipes.importBlocked') : t('recipes.importFailed'));
    } finally {
      setBusy(false);
    }
  }

  function fromText() {
    setError(null);
    try {
      void store(importRecipeFromText(pasted, url.trim() || undefined));
    } catch {
      setError(t('recipes.importFailed'));
    }
  }

  return (
    <Sheet open onClose={onClose} title={t('recipes.import')}>
      <Field label={t('recipes.importUrl')}>
        <Input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Button
        variant="primary"
        className="mt-3 w-full"
        disabled={!url.trim() || busy}
        onClick={() => void fromUrl()}
      >
        {busy ? t('app.loading') : t('recipes.importRun')}
      </Button>

      {error && <p className="mt-3 text-sm text-[var(--color-warn)]">{error}</p>}

      <div className="mt-6 border-t border-[var(--color-border)] pt-4">
        <Field label={t('recipes.importPaste')}>
          <textarea
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            className="w-full resize-y rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 outline-none focus:border-[var(--color-accent)]"
          />
        </Field>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{t('recipes.importPasteHint')}</p>
        <Button className="mt-3 w-full" disabled={!pasted.trim()} onClick={fromText}>
          {t('recipes.importRun')}
        </Button>
      </div>
    </Sheet>
  );
}
