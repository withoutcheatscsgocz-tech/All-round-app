import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import { db, getSetting, setSetting } from '../db/db';
import { I18nContext, translate, type Lang, type TKey } from '../i18n';

export type Theme = 'system' | 'light' | 'dark';

interface AppSettings {
  lang: Lang;
  theme: Theme;
}

const DEFAULTS: AppSettings = { lang: 'cs', theme: 'system' };

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#0b1020' : '#f6f7fb');
}

interface AppSettingsCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const AppSettingsContext = createContext<AppSettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lang, theme] = await Promise.all([
        getSetting<Lang>('lang', DEFAULTS.lang),
        getSetting<Theme>('theme', DEFAULTS.theme),
      ]);
      if (cancelled) return;
      setSettings({ lang, theme });
      document.documentElement.lang = lang;
      setReady(true);
    })().catch(() => setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    if (settings.theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [settings.theme]);

  const setLang = useCallback((lang: Lang) => {
    setSettings((s) => ({ ...s, lang }));
    document.documentElement.lang = lang;
    void setSetting('lang', lang);
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setSettings((s) => ({ ...s, theme }));
    void setSetting('theme', theme);
  }, []);

  const i18n = useMemo(
    () => ({
      lang: settings.lang,
      setLang,
      t: (key: TKey, vars?: Record<string, string | number>) =>
        translate(settings.lang, key, vars),
    }),
    [settings.lang, setLang],
  );

  const app = useMemo(
    () => ({ theme: settings.theme, setTheme }),
    [settings.theme, setTheme],
  );

  if (!ready) return null;

  return (
    <I18nContext.Provider value={i18n}>
      <AppSettingsContext.Provider value={app}>{children}</AppSettingsContext.Provider>
    </I18nContext.Provider>
  );
}

export function useAppSettings(): AppSettingsCtx {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error('useAppSettings musí být uvnitř <SettingsProvider>');
  return ctx;
}

/** Vymaže úplně všechna data (tlačítko v nebezpečné zóně nastavení). */
export async function wipeAllData(): Promise<void> {
  await db.delete();
  location.reload();
}
