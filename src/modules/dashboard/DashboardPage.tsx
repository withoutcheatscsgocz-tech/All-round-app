import { PageHeader } from '../../app/Layout';
import { getModules } from '../registry';
import { useI18n } from '../../i18n';
import { GettingStarted } from './GettingStarted';

function greeting(lang: 'cs' | 'en'): string {
  const h = new Date().getHours();
  if (lang === 'en') {
    if (h < 10) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  if (h < 10) return 'Dobré ráno';
  if (h < 18) return 'Hezký den';
  return 'Dobrý večer';
}

export function DashboardPage() {
  const { lang } = useI18n();
  const cards = getModules().filter((m) => m.DashboardCard);

  const dateLabel = new Intl.DateTimeFormat(lang === 'cs' ? 'cs-CZ' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <>
      <PageHeader title={greeting(lang)} />
      <p className="-mt-2 mb-6 text-sm text-[var(--color-muted)] first-letter:uppercase">{dateLabel}</p>

      <div className="space-y-4">
        {cards.map((m) => {
          const Card = m.DashboardCard!;
          return <Card key={m.id} />;
        })}
      </div>

      <div className="mt-6">
        <GettingStarted />
      </div>
    </>
  );
}
