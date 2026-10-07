import { useEffect, useRef } from 'react';

/**
 * Brief fade (+ 4px rise) of an element when `key` changes. It animates the existing element with the
 * Web Animations API instead of remounting it, so view state (drafts, scroll, mounted Profile) is untouched.
 * Skipped on first mount and when the user prefers reduced motion.
 */
export function useScreenTransition<T extends HTMLElement>(key: string) {
  const ref = useRef<T>(null);
  const previous = useRef(key);
  useEffect(() => {
    if (previous.current === key) return;
    previous.current = key;
    const el = ref.current;
    if (!el || typeof el.animate !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    el.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 170, easing: 'cubic-bezier(0, 0, 0.2, 1)' });
  }, [key]);
  return ref;
}
