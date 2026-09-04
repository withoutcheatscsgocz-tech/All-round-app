import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PageHeader } from '../../app/Layout';
import { useI18n } from '../../i18n';
import { Button, Card, EmptyState, Field, Input, Section, Select, Sheet } from '../../components/ui';
import { db } from '../../db/db';
import { addMonths, todayIso } from '../../lib/date';
import { summariseByCategory, totalSpent, CATEGORY_ICONS, CATEGORY_KEYS, CATEGORY_LABELS, type CategoryKey } from './data';
import { summariseMonth } from '../shifts/pay';
import { usePayConfig, useShiftTypeMap } from '../shifts/data';
import type { Expense } from '../../db/types';

function useMoney() {
  const { lang } = useI18n();
  return useMemo(
    () => new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
      style: 'currency', currency: 'CZK', maximumFractionDigits: 0,
    }),
    [lang],
  );
}

/** Hlavní číslo měsíce a k němu dvě doplňková — žádný graf, jen text. */
function StatRow({ spent, earned }: { spent: number; earned: number }) {
  const { t } = useI18n();
  const money = useMoney();
  const left = earned - spent;

  return (
    <Card className="mb-4">
      <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
        {t('expenses.spent')}
      </p>
      <p className="text-3xl font-bold tabular-nums">{money.format(spent)}</p>

      {earned > 0 && (
        <div className="mt-3 flex gap-6 border-t border-[var(--color-border)] pt-3">
          <div>
            <p className="text-xs text-[var(--color-muted)]">{t('expenses.earned')}</p>
            <p className="font-semibold tabular-nums">{money.format(earned)}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-muted)]">
              {left >= 0 ? t('expenses.left') : t('expenses.over')}
            </p>
            <p className={`font-semibold tabular-nums ${left < 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'}`}>
              {money.format(Math.abs(left))}
            </p>
          </div>
        </div>
      )}
      {earned > 0 && <p className="mt-2 text-xs text-[var(--color-muted)]">{t('expenses.grossNote')}</p>}
    </Card>
  );
}

/**
 * Kategorie měří jednu a tu samou věc, proto jeden odstín a délka sloupce.
 * Barva se mění jen tam, kde nese informaci — přečerpaný rozpočet, a to
 * vždycky se slovem, ne jen barvou.
 */
function CategoryBars({ expenses, budgets }: { expenses: Expense[]; budgets: Record<string, number> }) {
  const { t } = useI18n();
  const money = useMoney();
  const rows = summariseByCategory(expenses, budgets);

  if (rows.length === 0) return null;

  return (
    <Card>
      <ul className="space-y-3">
        {rows.map((row) => {
          const key = row.category as CategoryKey;
          const label = CATEGORY_LABELS[key] ? t(CATEGORY_LABELS[key]) : row.category;
          return (
            <li key={row.category}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm">
                  {CATEGORY_ICONS[key] ?? '📦'} {label}
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {money.format(row.total)}
                </span>
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-2)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(row.share * 100, 2)}%`,
                    background: row.overBudget ? 'var(--color-bad)' : 'var(--color-accent)',
                  }}
                />
              </div>

              {row.budget !== undefined && (
                <p className={`mt-0.5 text-xs ${row.overBudget ? 'text-[var(--color-bad)]' : 'text-[var(--color-muted)]'}`}>
                  {row.overBudget
                    ? `${t('expenses.over')} ${money.format(row.total - row.budget)}`
                    : `${t('expenses.left')} ${money.format(row.budget - row.total)}`}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ExpenseEditor({ initial, month, onClose }: {
  initial: Expense | null;
  month: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [expense, setExpense] = useState<Expense>(
    initial ?? { date: todayIso().startsWith(month) ? todayIso() : `${month}-01`, amount: 0, category: 'food' },
  );

  const set = <K extends keyof Expense>(key: K, value: Expense[K]) =>
    setExpense((prev) => ({ ...prev, [key]: value }));

  return (
    <Sheet open onClose={onClose} title={t('expenses.add')}>
      <div className="space-y-3">
        <Field label={t('expenses.amount')}>
          <Input
            type="number"
            inputMode="decimal"
            value={expense.amount || ''}
            onChange={(e) => set('amount', Number(e.target.value))}
            autoFocus
          />
        </Field>
        <Field label={t('expenses.category')}>
          <Select value={expense.category} onChange={(e) => set('category', e.target.value)}>
            {CATEGORY_KEYS.map((key) => (
              <option key={key} value={key}>{CATEGORY_ICONS[key]} {t(CATEGORY_LABELS[key])}</option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.date')}>
          <Input type="date" value={expense.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field label={t('common.note')}>
          <Input value={expense.note ?? ''} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </div>

      <div className="mt-5 flex gap-2">
        <Button
          variant="primary"
          className="flex-1"
          disabled={!expense.amount}
          onClick={() => void db.expenses.put(expense).then(onClose)}
        >
          {t('common.save')}
        </Button>
        {expense.id !== undefined && (
          <Button variant="danger" onClick={() => void db.expenses.delete(expense.id!).then(onClose)}>
            {t('common.delete')}
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function BudgetEditor({ month, current, onClose }: {
  month: string;
  current: Record<string, number>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [limits, setLimits] = useState<Record<string, number>>(current);

  async function save() {
    const cleaned = Object.fromEntries(Object.entries(limits).filter(([, v]) => v > 0));
    const existing = await db.budgets.where('month').equals(month).first();
    await db.budgets.put(existing?.id ? { ...existing, limits: cleaned } : { month, limits: cleaned });
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={t('expenses.setBudget')}>
      <div className="space-y-3">
        {CATEGORY_KEYS.map((key) => (
          <Field key={key} label={`${CATEGORY_ICONS[key]} ${t(CATEGORY_LABELS[key])}`}>
            <Input
              type="number"
              inputMode="decimal"
              value={limits[key] ?? ''}
              onChange={(e) => setLimits((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
            />
          </Field>
        ))}
      </div>
      <Button variant="primary" className="mt-4 w-full" onClick={() => void save()}>
        {t('common.save')}
      </Button>
    </Sheet>
  );
}

export function ExpensesPage() {
  const { t, lang } = useI18n();
  const money = useMoney();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [editing, setEditing] = useState<Expense | null | undefined>(undefined);
  const [budgetOpen, setBudgetOpen] = useState(false);

  const expenses = useLiveQuery(
    () => db.expenses.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );
  const budget = useLiveQuery(() => db.budgets.where('month').equals(month).first(), [month]);
  const shifts = useLiveQuery(
    () => db.shifts.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );

  const types = useShiftTypeMap();
  const [payConfig] = usePayConfig();
  const shiftSummary = summariseMonth(shifts, types, payConfig);
  const earned = shiftSummary.pay.net ?? shiftSummary.pay.gross;

  const monthLabel = new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    month: 'long', year: 'numeric',
  }).format(new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1));

  return (
    <>
      <PageHeader
        title={t('expenses.title')}
        action={<Button variant="primary" onClick={() => setEditing(null)}>+</Button>}
      />

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, -1))}>←</Button>
        <span className="text-lg font-semibold first-letter:uppercase">{monthLabel}</span>
        <Button variant="subtle" onClick={() => setMonth(addMonths(month, 1))}>→</Button>
      </div>

      <StatRow spent={totalSpent(expenses)} earned={earned} />

      {expenses.length === 0 ? (
        <EmptyState
          title={t('expenses.noExpenses')}
          action={<Button variant="primary" onClick={() => setEditing(null)}>+ {t('expenses.add')}</Button>}
        />
      ) : (
        <>
          <Section
            title={t('expenses.byCategory')}
            action={<Button variant="ghost" onClick={() => setBudgetOpen(true)}>{t('expenses.setBudget')}</Button>}
          >
            <CategoryBars expenses={expenses} budgets={budget?.limits ?? {}} />
          </Section>

          <Section title={t('expenses.recent')}>
            <Card>
              <ul className="divide-y divide-[var(--color-border)]">
                {[...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((expense) => {
                  const key = expense.category as CategoryKey;
                  return (
                    <li key={expense.id}>
                      <button onClick={() => setEditing(expense)} className="flex w-full items-center gap-3 py-2 text-left">
                        <span className="text-lg">{CATEGORY_ICONS[key] ?? '📦'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">
                            {expense.note || (CATEGORY_LABELS[key] ? t(CATEGORY_LABELS[key]) : expense.category)}
                          </span>
                          <span className="text-xs text-[var(--color-muted)]">
                            {new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
                              day: 'numeric', month: 'numeric',
                            }).format(new Date(expense.date))}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{money.format(expense.amount)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </Section>
        </>
      )}

      {editing !== undefined && (
        <ExpenseEditor initial={editing} month={month} onClose={() => setEditing(undefined)} />
      )}
      {budgetOpen && (
        <BudgetEditor month={month} current={budget?.limits ?? {}} onClose={() => setBudgetOpen(false)} />
      )}
    </>
  );
}
