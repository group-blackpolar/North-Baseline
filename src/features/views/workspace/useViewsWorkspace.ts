import { useCallback, useEffect, useRef, useState } from 'react';
import { listRevisions, type PanelRevisionSummary } from '@/lib/northAdmin';
import { mapLimit } from '@/features/admin-center/hooks';
import { emptyFilters, filtersToParams, hasFilterParams, paramsToFilters, type ViewFilters, type ViewResource } from './resources';

const sessionKey = (organizationId: string) => `north-views-filters:${organizationId}`;
const savedKey = (organizationId: string) => `north-views-saved:${organizationId}`;
const OWN_PARAMS = ['vq', 'vk', 'vs', 'vc', 'vsub', 'va', 'vuf', 'vut', 'vcf', 'vct', 'vu', 'vo', 'vsort', 'vdir'];

function loadInitial(organizationId: string): ViewFilters {
  try {
    const params = new URLSearchParams(window.location.search);
    if (hasFilterParams(params)) return paramsToFilters(params);
    const stored = window.sessionStorage.getItem(sessionKey(organizationId));
    if (stored) return paramsToFilters(new URLSearchParams(stored));
  } catch { /* storage unavailable: start clean */ }
  return emptyFilters();
}

/**
 * Filters for the Views workspace. They live in React state and are mirrored to the URL (so a view of the list can be
 * shared or reloaded) and to sessionStorage (temporary persistence per organization). The pathname is never touched, so
 * the organization/panel routing is unaffected; leaving the screen removes our parameters again.
 */
export function useViewFilters(organizationId: string) {
  const [filters, setFilters] = useState<ViewFilters>(() => loadInitial(organizationId));

  useEffect(() => {
    const params = filtersToParams(filters);
    try {
      window.sessionStorage.setItem(sessionKey(organizationId), params.toString());
      const url = new URL(window.location.href);
      OWN_PARAMS.forEach((name) => url.searchParams.delete(name));
      params.forEach((value, name) => url.searchParams.set(name, value));
      const next = `${url.pathname}${url.search}${url.hash}`;
      if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history.replaceState(window.history.state, '', next);
    } catch { /* ignore */ }
  }, [filters, organizationId]);

  useEffect(() => () => {
    try {
      const url = new URL(window.location.href);
      if (!OWN_PARAMS.some((name) => url.searchParams.has(name))) return;
      OWN_PARAMS.forEach((name) => url.searchParams.delete(name));
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    } catch { /* ignore */ }
  }, []);

  const patch = useCallback((change: Partial<ViewFilters>) => setFilters((current) => ({ ...current, ...change })), []);
  const clear = useCallback(() => setFilters((current) => ({ ...emptyFilters(), sort: current.sort, dir: current.dir })), []);
  return { filters, setFilters, patch, clear };
}

export interface SavedFilter { id: string; name: string; query: string }

/** Named filter sets: a per-person convenience stored in this browser only (not shared, not authoritative). */
export function useSavedFilters(organizationId: string) {
  const [saved, setSaved] = useState<SavedFilter[]>(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(savedKey(organizationId)) ?? '[]') as SavedFilter[];
      return Array.isArray(raw) ? raw.filter((item) => typeof item?.id === 'string' && typeof item.name === 'string' && typeof item.query === 'string').slice(0, 10) : [];
    } catch { return []; }
  });
  const persist = (next: SavedFilter[]) => {
    setSaved(next);
    try { window.localStorage.setItem(savedKey(organizationId), JSON.stringify(next)); } catch { /* storage unavailable */ }
  };
  return {
    saved,
    save: (name: string, filters: ViewFilters) => persist([{ id: crypto.randomUUID(), name: name.trim().slice(0, 60), query: filtersToParams(filters).toString() }, ...saved].slice(0, 10)),
    remove: (id: string) => persist(saved.filter((item) => item.id !== id)),
    load: (item: SavedFilter) => paramsToFilters(new URLSearchParams(item.query)),
  };
}

export interface RevisionInfo { latestNumber: number; latestBy: string | null; latestAt: string; publishedNumber: number | null; publishedAt: string | null }

export function summarizeRevisions(revisions: PanelRevisionSummary[], publishedRevisionId: string | null): RevisionInfo | null {
  if (revisions.length === 0) return null;
  const latest = revisions.reduce((best, revision) => (revision.revisionNumber > best.revisionNumber ? revision : best));
  const published = publishedRevisionId ? revisions.find((revision) => revision.id === publishedRevisionId) : undefined;
  return { latestNumber: latest.revisionNumber, latestBy: latest.createdBy ?? null, latestAt: latest.createdAt, publishedNumber: published?.revisionNumber ?? null, publishedAt: published ? published.publishAt ?? published.createdAt : null };
}

/**
 * Version / author / publication date are not in the management tree, so they are read per visible view from the
 * revisions endpoint (bounded concurrency, cached, invalidated by writes). Rows without data simply show an em dash.
 */
export function useRevisionInfo(organizationId: string, panels: ViewResource[]) {
  const [info, setInfo] = useState<Record<string, RevisionInfo | null | 'error'>>({});
  const requested = useRef(new Set<string>());

  useEffect(() => { requested.current.clear(); setInfo({}); }, [organizationId]);

  useEffect(() => {
    const todo = panels.filter((panel) => panel.kind === 'PANEL' && (panel.draftRevisionId || panel.publishedRevisionId) && !requested.current.has(`${panel.id}:${panel.updatedAt}`));
    if (todo.length === 0) return;
    todo.forEach((panel) => requested.current.add(`${panel.id}:${panel.updatedAt}`));
    let live = true;
    void mapLimit(todo, 4, async (panel) => {
      try {
        const result = summarizeRevisions(await listRevisions(organizationId, panel.id), panel.publishedRevisionId);
        if (live) setInfo((current) => ({ ...current, [panel.id]: result }));
      } catch {
        if (live) setInfo((current) => ({ ...current, [panel.id]: 'error' }));
      }
    });
    return () => { live = false; };
  }, [organizationId, panels]);

  return info;
}
