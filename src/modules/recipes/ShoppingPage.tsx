import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Input } from '../../components/ui';
import { db } from '../../db/db';
import { parseIngredient } from './parse';

export function ShoppingPage() {
  const { t } = useI18n();
  const [text, setText] = useState('');
  const items = useLiveQuery(() => db.shoppingItems.toArray(), [], []);

  const open = items.filter((i) => i.done === 0);
  const done = items.filter((i) => i.done === 1);

  async function add() {
    const parsed = parseIngredient(text);
    if (!parsed) return;
    await db.shoppingItems.add({
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      done: 0,
      createdAt: Date.now(),
    });
    setText('');
  }

  const row = (item: (typeof items)[number]) => (
    <li key={item.id} className="flex items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={item.done === 1}
        onChange={() => void db.shoppingItems.update(item.id!, { done: item.done ? 0 : 1 })}
        className="h-5 w-5 shrink-0"
      />
      <span className={`min-w-0 flex-1 ${item.done ? 'text-[var(--color-muted)] line-through' : ''}`}>
        {item.amount !== undefined && (
          <span className="mr-2 font-medium tabular-nums">
            {String(item.amount).replace('.', ',')}{item.unit ? ` ${item.unit}` : ''}
          </span>
        )}
        {item.name}
      </span>
      <button
        onClick={() => void db.shoppingItems.delete(item.id!)}
        className="shrink-0 text-[var(--color-muted)]"
        aria-label={t('common.delete')}
      >
        ✕
      </button>
    </li>
  );

  return (
    <>
      <PageHeader
        title={t('recipes.shopping')}
        action={<Link to="/recipes" className="text-sm text-[var(--color-accent)]">{t('common.back')}</Link>}
      />

      <div className="mb-4 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add(); }}
          placeholder={t('recipes.addItem')}
        />
        <Button variant="primary" disabled={!text.trim()} onClick={() => void add()}>+</Button>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t('recipes.shoppingEmpty')} />
      ) : (
        <Card>
          <ul className="divide-y divide-[var(--color-border)]">
            {open.map(row)}
            {done.map(row)}
          </ul>
          {done.length > 0 && (
            <Button
              className="mt-4 w-full"
              onClick={() => void db.shoppingItems.where('done').equals(1).delete()}
            >
              {t('recipes.clearDone')} ({done.length})
            </Button>
          )}
        </Card>
      )}
    </>
  );
}
