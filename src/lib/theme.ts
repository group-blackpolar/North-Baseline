import { useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark' | 'midnight';
/** What the user picks: a concrete theme or "system" (follows the OS light/dark setting). */
export type ThemePreference = ThemeName | 'system';

const THEME_KEY = 'north-theme-v1';

/** "system" resolves to light or dark by the OS setting; concrete themes resolve to themselves. */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ThemeName {
  if (preference === 'system') return prefersDark ? 'dark' : 'light';
  return preference;
}

const systemDark = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)').matches : false);

export function getThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'midnight' || raw === 'system') return raw;
    const legacy = localStorage.getItem('bp-theme');
    if (legacy === 'dark') return 'dark';
  } catch {
    /* storage no disponible */
  }
  return 'light';
}

/** The concrete theme in effect (never "system"). */
export function getStoredTheme(): ThemeName {
  return resolveTheme(getThemePreference(), systemDark());
}

/** Aplica el tema al <html>: data-theme (tokens) + clase .dark (compat con mecanismo existente). */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  const theme = resolveTheme(preference, systemDark());
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark' || theme === 'midnight');
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* storage no disponible */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => getThemePreference());

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof matchMedia !== 'function') return;
    const query = matchMedia('(prefers-color-scheme: dark)');
    const follow = () => applyTheme('system');
    query.addEventListener('change', follow);
    return () => query.removeEventListener('change', follow);
  }, [theme]);

  return { theme, setTheme, resolved: resolveTheme(theme, systemDark()) };
}
