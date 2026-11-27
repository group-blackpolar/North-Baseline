import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * True when a component sits in a fixed-matrix cell (section `rowHeight`/`fit`): it must fill the cell and scroll or
 * clip inside it instead of imposing its own height, and it may use denser spacing.
 */
const CellFillContext = createContext(false);
export const CellFillProvider = CellFillContext.Provider;
export const useCellFill = () => useContext(CellFillContext);

/**
 * Live pixel size of an element, so a chart can decide what fits (how many bars, whether a centre label is legible).
 * `outer` reports the border box, which scrollbars appearing inside the element do not change.
 */
export function useElementSize<T extends HTMLElement>(outer = false) {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const next = outer ? { width: element.offsetWidth, height: element.offsetHeight } : { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) };
      setSize((current) => (current.width === next.width && current.height === next.height ? current : next));
    });
    observer.observe(element, outer ? { box: 'border-box' } : undefined);
    return () => observer.disconnect();
  }, [outer]);
  return [ref, size] as const;
}
