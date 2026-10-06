import { useSyncExternalStore } from 'react';

/** Shell modes from docs/tasks/TASK_NORTH_DESIGN_SYSTEM.md §4.6. Widths are CSS px (before density zoom). */
export type ShellMode = 'phone' | 'tablet' | 'compact' | 'desktop' | 'wide';

const BREAKPOINTS = [768, 1024, 1280, 1680] as const;
const MODES: ShellMode[] = ['phone', 'tablet', 'compact', 'desktop', 'wide'];

// One MediaQueryList per breakpoint, shared by every consumer (no per-component resize listeners).
const lists = typeof window === 'undefined' ? [] : BREAKPOINTS.map((px) => window.matchMedia(`(min-width: ${px}px)`));

function subscribe(onChange: () => void) {
  lists.forEach((l) => l.addEventListener('change', onChange));
  return () => lists.forEach((l) => l.removeEventListener('change', onChange));
}

const getMode = (): ShellMode => MODES[lists.filter((l) => l.matches).length];

export const useShellMode = () => useSyncExternalStore(subscribe, getMode, () => 'desktop' as ShellMode);

/** Phone and portrait tablet use the drawer shell instead of the rails. */
export const useIsCompactShell = () => {
  const mode = useShellMode();
  return mode === 'phone' || mode === 'tablet';
};

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const l = window.matchMedia(query);
      l.addEventListener('change', cb);
      return () => l.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
