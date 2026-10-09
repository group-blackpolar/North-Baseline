/**
 * Overlays mount inside the application shell (`.north-app-shell`) so they inherit its theme and stacking context.
 * While an element is fullscreen only its subtree is rendered, so overlays mount inside it instead.
 * Falls back to <body> when the shell is not mounted.
 */
export const portalContainer = (): HTMLElement | undefined => {
  if (typeof document === 'undefined') return undefined;
  const fullscreen = document.fullscreenElement;
  if (fullscreen instanceof HTMLElement) return fullscreen;
  return document.querySelector<HTMLElement>('.north-app-shell') ?? undefined;
};
