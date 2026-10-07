import { useEffect, useRef, useState } from 'react';

/**
 * Turns a fast-flipping `active` flag into one that never flashes.
 * - it only becomes true after `delay` ms of continuous activity (a response that arrives sooner never shows a loader);
 * - once true it stays true for at least `minVisible` ms (a loader that did appear never blinks away).
 */
export function useDelayedFlag(active: boolean, delay = 150, minVisible = 280): boolean {
  const [shown, setShown] = useState(false);
  const since = useRef(0);

  useEffect(() => {
    if (active) {
      if (shown) return;
      const timer = window.setTimeout(() => { since.current = Date.now(); setShown(true); }, delay);
      return () => window.clearTimeout(timer);
    }
    if (!shown) return;
    const timer = window.setTimeout(() => setShown(false), Math.max(0, minVisible - (Date.now() - since.current)));
    return () => window.clearTimeout(timer);
  }, [active, shown, delay, minVisible]);

  return shown;
}
