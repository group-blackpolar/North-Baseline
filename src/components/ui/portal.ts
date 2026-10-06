/**
 * Overlays mount inside the density-zoomed shell (`.north-app-shell`) so they share its coordinate space;
 * a portal into <body> would be positioned from zoomed rects but styled unzoomed. Falls back to <body>.
 */
export const portalContainer = (): HTMLElement | undefined =>
  (typeof document === 'undefined' ? undefined : document.querySelector<HTMLElement>('.north-app-shell')) ?? undefined;
