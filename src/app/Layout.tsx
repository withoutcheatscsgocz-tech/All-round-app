import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { getModules } from '../modules/registry';
import { useT } from '../i18n';
import { Sheet } from '../components/ui';

const TABS_IN_BAR = 4;

export function Layout() {
  const t = useT();
  const modules = getModules();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primary = modules.slice(0, TABS_IN_BAR);
  const rest = modules.slice(TABS_IN_BAR);
  const restActive = rest.some((m) => location.pathname.startsWith(`/${m.path}`));

  return (
    <div className="flex min-h-full flex-col">
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-safe pb-32">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 pb-safe backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-stretch">
          {primary.map((m) => (
            <NavLink
              key={m.id}
              to={`/${m.path}`}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
                }`
              }
            >
              <span className="text-xl leading-none">{m.icon}</span>
              <span className="truncate px-1">{t(m.titleKey)}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
              restActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'
            }`}
          >
            <span className="text-xl leading-none">⋯</span>
            <span>{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t('nav.more')}>
        <div className="grid grid-cols-3 gap-3">
          {rest.map((m) => (
            <NavLink
              key={m.id}
              to={`/${m.path}`}
              onClick={() => setMoreOpen(false)}
              className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] p-4 text-center text-xs"
            >
              <span className="text-2xl leading-none">{m.icon}</span>
              {t(m.titleKey)}
            </NavLink>
          ))}
          <NavLink
            to="/settings"
            onClick={() => setMoreOpen(false)}
            className="flex flex-col items-center gap-2 rounded-2xl border border-[var(--color-border)] p-4 text-center text-xs"
          >
            <span className="text-2xl leading-none">⚙️</span>
            {t('nav.settings')}
          </NavLink>
        </div>
      </Sheet>
    </div>
  );
}

export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 -mx-4 mb-4 flex items-center justify-between gap-3 bg-[var(--color-bg)]/90 px-4 py-4 backdrop-blur">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {action}
    </header>
  );
}
