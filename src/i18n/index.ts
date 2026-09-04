import { createContext, useContext } from 'react';
import { cs } from './cs';
import { en } from './en';

export type Lang = 'cs' | 'en';

/** Překlad smí být neúplný a literály z `as const` se rozšíří na obyčejný string. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string
    ? string
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

/** Všechny tečkové cesty ke stringům ve slovníku — díky tomu překlepy v klíči neprojdou. */
type Paths<T> = T extends string
  ? never
  : { [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}` }[keyof T & string];

export type TKey = Paths<typeof cs>;

const DICTS = { cs, en } as const;

function lookup(dict: unknown, path: string): string | undefined {
  const value = path.split('.').reduce<unknown>(
    (acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined),
    dict,
  );
  return typeof value === 'string' ? value : undefined;
}

/** Přeloží klíč a doplní {placeholdery}. Chybějící překlad spadne zpátky do češtiny. */
export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  const text = lookup(DICTS[lang], key) ?? lookup(cs, key) ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (m, name: string) =>
    name in vars ? String(vars[name]) : m,
  );
}

export interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

export const I18nContext = createContext<I18n | null>(null);

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n musí být uvnitř <SettingsProvider>');
  return ctx;
}

/** Zkratka pro komponenty, které potřebují jen překládat. */
export function useT() {
  return useI18n().t;
}

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'cs', label: 'Čeština' },
  { value: 'en', label: 'English' },
];
