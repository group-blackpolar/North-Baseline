import { useEffect, useState } from 'react';

export type ThemeName = 'light' | 'dark' | 'midnight' | 'system';
type ResolvedTheme = 'light' | 'dark' | 'midnight';

const THEME_KEY = 'north-theme-v1';

export function getStoredTheme(): ThemeName {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'midnight' || raw === 'system') return raw;
  } catch {
    /* storage no disponible */
  }
  return 'system';
}

export function resolveTheme(theme: ThemeName): ResolvedTheme {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Aplica el tema al <html>: data-theme (tokens) + clase .dark (compat con mecanismo existente). */
export function applyTheme(theme: ThemeName): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.classList.toggle('dark', resolved === 'dark' || resolved === 'midnight');
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
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
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme, resolved: resolveTheme(theme) };
}