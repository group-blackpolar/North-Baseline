import { useCallback, useEffect, useRef } from 'react';

/**
 * Lets the browser Back button close a drawer/sheet before it navigates away.
 * Opening pushes one marker entry; closing through the UI pops it. `go(fn)` pops the marker first and
 * runs `fn` afterwards, so a real navigation started from inside the overlay lands on a clean stack.
 */
export function useOverlayHistory(open: boolean, onClose: () => void) {
  const marker = useRef(false);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });

  useEffect(() => {
    if (!open) return;
    history.pushState({ ...(history.state ?? {}), npOverlay: true }, '');
    marker.current = true;
    const onPop = () => { marker.current = false; close.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (marker.current) { marker.current = false; history.back(); }
    };
  }, [open]);

  return useCallback((fn: () => void) => {
    if (!marker.current) { fn(); close.current(); return; }
    marker.current = false;
    window.addEventListener('popstate', () => fn(), { once: true });
    history.back();
    close.current();
  }, []);
}
