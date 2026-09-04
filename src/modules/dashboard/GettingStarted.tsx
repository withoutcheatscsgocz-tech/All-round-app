import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting } from '../../db/db';
import { useI18n } from '../../i18n';
import { Card, Section } from '../../components/ui';
import type { TKey } from '../../i18n';

interface Step {
  to: string;
  icon: string;
  titleKey: TKey;
  hintKey: TKey;
  done: boolean;
}

/**
 * Na prázdné appce sama „Dnes" nic neukáže, takže první spuštění navede,
 * co si nastavit. Jakmile je hotovo všechno, zmizí.
 */
export function GettingStarted() {
  const { t } = useI18n();

  const shifts = useLiveQuery(() => db.shifts.count(), [], -1);
  const stops = useLiveQuery(() => db.favStops.count(), [], -1);
  const recipes = useLiveQuery(() => db.recipes.count(), [], -1);
  const place = useLiveQuery(() => getSetting<unknown>('weather.place', null), [], undefined);

  // Než se databáze načte, nic nebliká.
  if (shifts < 0 || stops < 0 || recipes < 0 || place === undefined) return null;

  const steps: Step[] = [
    { to: '/shifts', icon: '🗓️', titleKey: 'start.shifts', hintKey: 'start.shiftsHint', done: shifts > 0 },
    { to: '/transit', icon: '🚌', titleKey: 'start.transit', hintKey: 'start.transitHint', done: stops > 0 },
    { to: '/weather', icon: '🌤️', titleKey: 'start.weather', hintKey: 'start.weatherHint', done: place !== null },
    { to: '/recipes', icon: '🍳', titleKey: 'start.recipes', hintKey: 'start.recipesHint', done: recipes > 0 },
  ];

  const todo = steps.filter((step) => !step.done);
  if (todo.length === 0) return null;

  return (
    <Section title={t('start.title')}>
      <p className="mb-2 px-1 text-sm text-[var(--color-muted)]">{t('start.hint')}</p>
      <Card className="!p-0">
        <ul className="divide-y divide-[var(--color-border)]">
          {todo.map((step) => (
            <li key={step.to}>
              <Link to={step.to} className="flex items-center gap-3 px-4 py-3">
                <span className="text-xl">{step.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t(step.titleKey)}</span>
                  <span className="block truncate text-xs text-[var(--color-muted)]">{t(step.hintKey)}</span>
                </span>
                <span className="shrink-0 text-[var(--color-muted)]">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
