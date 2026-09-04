import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card } from '../../components/ui';
import { todayIso } from '../../lib/date';
import { summariseMonth } from '../shifts/pay';
import { usePayConfig, useShiftTypeMap } from '../shifts/data';
import { totalSpent } from './data';

export function ExpensesCard() {
  const { t, lang } = useI18n();
  const month = todayIso().slice(0, 7);

  const expenses = useLiveQuery(
    () => db.expenses.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );
  const shifts = useLiveQuery(
    () => db.shifts.where('date').between(`${month}-00`, `${month}-99`).toArray(),
    [month],
    [],
  );

  const types = useShiftTypeMap();
  const [payConfig] = usePayConfig();

  const money = useMemo(
    () => new Intl.NumberFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
      style: 'currency', currency: 'CZK', maximumFractionDigits: 0,
    }),
    [lang],
  );

  if (expenses.length === 0) return null;

  const spent = totalSpent(expenses);
  const summary = summariseMonth(shifts, types, payConfig);
  const earned = summary.pay.net ?? summary.pay.gross;
  const left = earned - spent;

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">💸 {t('expenses.thisMonth')}</h3>
        <Link to="/expenses" className="text-sm text-[var(--color-accent)]">{t('common.open')}</Link>
      </div>

      <div className="flex gap-6">
        <div>
          <p className="text-xs text-[var(--color-muted)]">{t('expenses.spent')}</p>
          <p className="text-xl font-bold tabular-nums">{money.format(spent)}</p>
        </div>
        {earned > 0 && (
          <div>
            <p className="text-xs text-[var(--color-muted)]">
              {left >= 0 ? t('expenses.left') : t('expenses.over')}
            </p>
            <p className={`text-xl font-bold tabular-nums ${left < 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'}`}>
              {money.format(Math.abs(left))}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
