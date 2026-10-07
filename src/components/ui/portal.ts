/**
 * Overlays mount inside the application shell (`.north-app-shell`) so they inherit its theme and stacking context.
 * Falls back to <body> when the shell is not mounted.
 */
export const portalContainer = (): HTMLElement | undefined =>
  (typeof document === 'undefined' ? undefined : document.querySelector<HTMLElement>('.north-app-shell')) ?? undefined;
