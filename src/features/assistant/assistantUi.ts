// Framework-free rules for the assistant surfaces (unit-tested with `node --test`).

export type AssistantMode = 'closed' | 'compact' | 'side' | 'full';
export const DOCK_MIN = 320;
export const DOCK_MAX = 640;
export const DOCK_DEFAULT = 400;

/** The side panel never gets narrower than a usable chat nor wider than 60 % of the window (the page stays usable beside it). */
export function clampDockWidth(width: number, viewportWidth: number): number {
  const max = Math.max(DOCK_MIN, Math.min(DOCK_MAX, Math.floor(viewportWidth * 0.6)));
  return Math.round(Math.min(max, Math.max(DOCK_MIN, Number.isFinite(width) ? width : DOCK_DEFAULT)));
}

/** What a page may offer the assistant. Only identifiers and a short label: never content, never answers. */
export interface PageContext { module: string; label?: string; resource?: { type: 'evaluation'; id: string } }

const MODULE = /^[a-z][a-z0-9-]{0,40}$/;
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 41);

/** Merges the page the person is on with what the open screen registered. Nothing is sent unless the person turned sharing on. */
export function buildRunContext(input: { share: boolean; page: { module: string; label?: string } | null; registered: PageContext | null }): PageContext | undefined {
  if (!input.share) return undefined;
  const base = input.registered ?? (input.page ? { module: slug(input.page.module), ...(input.page.label ? { label: input.page.label } : {}) } : null);
  if (!base || !MODULE.test(base.module)) return undefined;
  const label = base.label?.replace(/\s+/g, ' ').trim().slice(0, 120);
  return { module: base.module, ...(label ? { label } : {}), ...(base.resource ? { resource: base.resource } : {}) };
}

export function readDockWidth(storage: Pick<Storage, 'getItem'> | null, viewportWidth: number): number {
  try { const raw = Number(storage?.getItem('north-assistant-width')); return clampDockWidth(raw || DOCK_DEFAULT, viewportWidth); } catch { return clampDockWidth(DOCK_DEFAULT, viewportWidth); }
}
