/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import baseEs, { type Dictionary as BaseDictionary } from '@/locales/es';
import baseEn from '@/locales/en';
import { authEs, authEn, type AuthDictionary } from '@/locales/auth';

export type Dictionary = BaseDictionary & AuthDictionary;
export type Locale = 'es' | 'en';

/** Registrar un idioma nuevo = añadir su archivo base + auth */
const REGISTRIES: Record<Locale, Dictionary> = {
  es: { ...baseEs, ...authEs },
  en: { ...baseEn, ...authEn },
};

const STORAGE_KEY = 'north-locale';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: keyof Dictionary, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* storage no disponible */
  }
  return 'es';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(readLocale);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage no disponible */
    }
  }, []);

  const t = useCallback(
    (key: keyof Dictionary, vars?: Record<string, string | number>) => {
      let value: string = REGISTRIES[locale][key] ?? REGISTRIES.es[key] ?? String(key);
      if (vars) {
        for (const [name, replacement] of Object.entries(vars)) {
          value = value.replaceAll(`{${name}}`, String(replacement));
        }
      }
      return value;
    },
    [locale]
  );

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used within I18nProvider');
  return context;
}