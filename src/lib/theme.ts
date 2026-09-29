import { useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark' | 'midnight';

const THEME_KEY = 'north-theme-v1';

export function getStoredTheme(): ThemeName {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'midnight') return raw;
    const legacy = localStorage.getItem('bp-theme');
    if (legacy === 'dark') return 'dark';
  } catch {
    /* storage no disponible */
  }
  return 'light';
}

/** Aplica el tema al <html>: data-theme (tokens) + clase .dark (compat con mecanismo existente). */
export function applyTheme(theme: ThemeName): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'dark' || theme === 'midnight');
  root.style.colorScheme = theme === 'light' ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage no disponible */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeName>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return { theme, setTheme, resolved: theme };
}
