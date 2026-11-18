import { useEffect, useState } from 'react';

/**
 * Report sizing. One scale factor (--s) is derived from the MEASURED size of the report, never from the window, and drives
 * type, spacing and icons through the theme variables (see `.report-scale` in index.css). Nothing is zoomed.
 *
 * A "fit" report (fixed matrix that fills the viewport) scales by the tighter of width and height so its content always fits;
 * every other report scrolls, so it only needs a legible floor. Below PHONE_MAX / TABLET_MAX the layout itself changes
 * (the tablet / mobile positions of the document) instead of shrinking further.
 */
export const REPORT_BASE = { width: 2000, height: 1100 } as const;
export const SCALE_FIT_MIN = 0.6;
export const SCALE_READ_MIN = 0.8;
export const PHONE_MAX = 600;
export const TABLET_MAX = 900;

export type ReportMode = 'phone' | 'tablet' | 'screen';
export type ReportSize = { width: number; height: number };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function reportMode(width: number): ReportMode {
  return width < PHONE_MAX ? 'phone' : width < TABLET_MAX ? 'tablet' : 'screen';
}

/** Scale in [min, 1], rounded to 2 decimals so tiny resizes do not re-render the page. */
export function reportScale({ width, height }: ReportSize, fitted: boolean): number {
  if (width <= 0) return 1;
  const raw = fitted && height > 0 ? Math.min(width / REPORT_BASE.width, height / REPORT_BASE.height) : width / REPORT_BASE.width;
  const scale = clamp(raw, fitted ? SCALE_FIT_MIN : SCALE_READ_MIN, 1);
  return Math.round(scale * 100) / 100;
}

/** Live size of an element. Height is only tracked when asked (a scrolling page's height depends on its content).
 *  The element is held in state (callback ref) because the report may mount its <article> after the component itself. */
export function useReportSize<T extends HTMLElement>(trackHeight: boolean) {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ReportSize>(() => ({ width: typeof window === 'undefined' ? 0 : window.innerWidth, height: 0 }));
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const width = Math.round(entry.contentRect.width);
      const height = trackHeight ? Math.round(entry.contentRect.height) : 0;
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, trackHeight]);
  return [setElement, size, element] as const;
}
