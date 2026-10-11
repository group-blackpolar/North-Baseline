// A tiny hand-off between the assistant and the dashboard it points at. The assistant may ask for filters on a panel that is not
// open yet (it navigates first); the request waits here, keyed by panel id, until that panel's page has loaded its filter
// definitions and takes it. A request nobody takes within a minute is dropped. No React: unit-tested with `node --test`.
import type { FilterDirective } from './directives.ts';

export type PanelRequest = { id: string; panelId: string; kind: 'apply' | 'clear'; replace: boolean; filters: FilterDirective[]; at: number };

const TTL_MS = 60_000;
let pending: PanelRequest | null = null;
const listeners = new Set<() => void>();

export function postPanelRequest(request: Omit<PanelRequest, 'at'>, now = Date.now()) {
  pending = { ...request, at: now };
  for (const listener of [...listeners]) listener();
}

/** The waiting request for this panel, if any (not removed until `consumePanelRequest`). */
export function peekPanelRequest(panelId: string, now = Date.now()): PanelRequest | null {
  if (pending && now - pending.at > TTL_MS) pending = null;
  return pending && pending.panelId === panelId ? pending : null;
}

export function consumePanelRequest(id: string) {
  if (pending?.id === id) pending = null;
}

export function subscribePanelRequests(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export const resetPanelRequests = () => { pending = null; listeners.clear(); };
