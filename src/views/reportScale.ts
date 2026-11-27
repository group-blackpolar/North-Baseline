import { useEffect, useState } from 'react';

/**
 * Report sizing. One scale factor (--s) is derived from the MEASURED size of the report, never from the window, and drives
 * type, spacing and icons through the theme variables (see `.report-scale` in index.css). Nothing is zoomed.
 *
 * A "fit" report (fixed matrix that fills the viewport) scales by the tighter of width and height so its content always fits;
 * every other report scrolls, so it only needs a legible floor. Below PHONE_MAX / TABLET_MAX the layout itself changes
 * (the tablet / mobile positions of the document) instead of shrinking further.
 */
export const REPORT_BASE = { width: 1500, height: 1100 } as const;
/** Page chrome above the matrix of a fit report (title bar, filter band, padding) at scale 1. */
export const FIT_CHROME = 150;
const GAP_PX = { none: 0, sm: 8, md: 16, lg: 24 } as const;
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

type Placed = { id: string; type: string; props?: Record<string, unknown>; layout: { desktop: { y: number; h: number } } };
export type ScaleSection = { layout: { rowHeight?: number; fit?: boolean; gap?: keyof typeof GAP_PX }; components: Placed[] };

/**
 * Height a fit report needs at scale 1 (its tallest fit section: rows x rowHeight + gaps + chrome), or null when no section is a fit matrix.
 * The scale is then the largest one at which that content still fits the measured height, so a report never shrinks more than it must.
 */
export function fitContentHeight(sections: ReadonlyArray<ScaleSection>): number | null {
  let tallest: number | null = null;
  for (const section of sections) {
    const rowHeight = section.layout.rowHeight;
    if (!rowHeight || section.layout.fit !== true) continue;
    const grouped = new Set(section.components.flatMap((component) => (component.type === 'panel_group' && Array.isArray(component.props?.items) ? (component.props!.items as Array<{ componentId?: unknown }>).flatMap((item) => (typeof item.componentId === 'string' ? [item.componentId] : [])) : [])));
    const bottom = (component: Placed) => component.layout.desktop.y + component.layout.desktop.h;
    const band = Math.max(0, ...section.components.filter((component) => component.type === 'filter_bar').map(bottom));
    const rows = Math.max(1, Math.max(0, ...section.components.filter((component) => !grouped.has(component.id) && component.type !== 'filter_bar').map(bottom)) - band);
    const need = rows * rowHeight + (rows - 1) * GAP_PX[section.layout.gap ?? 'md'] + FIT_CHROME;
    tallest = Math.max(tallest ?? 0, need);
  }
  return tallest;
}

/** Scale in [min, 1], rounded to 2 decimals so tiny resizes do not re-render the page. `baseHeight` = the content's own need at scale 1. */
export function reportScale({ width, height }: ReportSize, fitted: boolean, baseHeight: number = REPORT_BASE.height): number {
  if (width <= 0) return 1;
  const raw = fitted && height > 0 ? Math.min(width / REPORT_BASE.width, height / baseHeight) : width / REPORT_BASE.width;
  const scale = clamp(raw, fitted ? SCALE_FIT_MIN : SCALE_READ_MIN, 1);
  return Math.round(scale * 100) / 100;
}

/** The report's own padding at scale 1 (both sides together), taken off its outer size. */
export const REPORT_PADDING = 24;

/**
 * The size the scale is derived from: the OUTER size less a constant. The padding itself grows with the scale, so reading
 * the content box feeds the scale back into its own input, and the whole report then flips between two sizes for ever.
 */
export const measuredReport = (element: { offsetWidth: number; offsetHeight: number }, trackHeight: boolean): ReportSize => ({
  width: Math.max(0, element.offsetWidth - REPORT_PADDING),
  height: trackHeight ? Math.max(0, element.offsetHeight - REPORT_PADDING) : 0,
});

/** Live size of an element. Height is only tracked when asked (a scrolling page's height depends on its content).
 *  The element is held in state (callback ref) because the report may mount its <article> after the component itself. */
export function useReportSize<T extends HTMLElement>(trackHeight: boolean) {
  const [element, setElement] = useState<T | null>(null);
  const [size, setSize] = useState<ReportSize>(() => ({ width: typeof window === 'undefined' ? 0 : window.innerWidth, height: 0 }));
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = measuredReport(element, trackHeight);
      setSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    });
    observer.observe(element, { box: 'border-box' });
    return () => observer.disconnect();
  }, [element, trackHeight]);
  return [setElement, size, element] as const;
}
