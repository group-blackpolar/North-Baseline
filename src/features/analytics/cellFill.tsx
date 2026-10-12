import { createContext, useContext, useEffect, useRef, useState } from 'react';

/**
 * True when a component sits in a fixed-matrix cell (section `rowHeight`/`fit`): it must fill the cell and scroll or
 * clip inside it instead of imposing its own height, and it may use denser spacing.
 */
const CellFillContext = createContext(false);
export const CellFillProvider = CellFillContext.Provider;
export const useCellFill = () => useContext(CellFillContext);

/**
 * A component in a fixed-matrix cell may ask the page for MORE height than the cell has (a table showing 100 rows): the page grows
 * (the main area scrolls) instead of the table being clipped or squeezed. `null` withdraws the request.
 */
export type CellGrowth = { report: (componentId: string, px: number | null) => void };
const CellGrowthContext = createContext<CellGrowth | null>(null);
export const CellGrowthProvider = CellGrowthContext.Provider;
export function useCellGrowth(componentId: string, px: number | null) {
  const growth = useContext(CellGrowthContext);
  useEffect(() => {
    growth?.report(componentId, px);
    return () => growth?.report(componentId, null);
  }, [growth, componentId, px]);
}

/** Live pixel size of an element, so a chart can decide what fits (how many bars, whether a centre label is legible). */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }); });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}
