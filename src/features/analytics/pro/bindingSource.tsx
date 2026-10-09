/* oxlint-disable react/only-export-components */
// One data contract for every analytics component, whether it renders in the published page or in the Studio preview.
// A component names its bindings (`data`, `total`, `trend`...); the source resolves them, applies the reader's filters
// and talks to CORECROW. Components never see tenant ids, dataset ids or queries.
import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import type { DatasetQueryFilter, DatasetQueryRow } from '../datasetQuery';
import type { AnalyticsRow, AnalyticsValue } from '../types';
import type { PanelBindingFilterDefinition } from '../panelBindingQuery';

export type BindingRequest = {
  filters?: DatasetQueryFilter[];
  sort?: { key: string; direction: 'ASC' | 'DESC' };
  offset?: number;
  limit?: number;
  search?: string;
  compare?: boolean;
};

export type BindingColumn = { key: string; fieldId?: string; type: string };
export type BindingResponse = {
  columns: BindingColumn[];
  rows: DatasetQueryRow[];
  rowCount: number;
  totalRows?: number;
  executedAt: string;
  filterDefinitions?: PanelBindingFilterDefinition[];
  comparison?: { period: { from: string; to: string }; previousPeriod: { from: string; to: string }; rows: DatasetQueryRow[] };
};

export type BindingSource = {
  /** Increments on refresh so every component refetches. */
  version: number;
  /** The filters the reader selected, already translated through this binding's own allowlist. */
  filtersFor: (bindingId: string) => DatasetQueryFilter[];
  fetch: (bindingId: string, request: BindingRequest, signal: AbortSignal) => Promise<BindingResponse>;
  /** Published pages register filter definitions and the freshest execution time; previews ignore both. */
  report?: (bindingId: string, response: BindingResponse) => void;
  /** Lets a component (map bubble, grid row action) narrow the dashboard; absent where filtering is unavailable. */
  applyFilter?: (fieldId: string, value: string | number | boolean) => void;
  /** Field ids the reader can currently filter on (from the binding definitions). */
  canFilter?: (fieldId: string) => boolean;
};

const SourceContext = createContext<BindingSource | null>(null);
export const BindingSourceProvider = ({ source, children }: { source: BindingSource; children: ReactNode }) => <SourceContext.Provider value={source}>{children}</SourceContext.Provider>;
export const useBindingSource = (): BindingSource | null => useContext(SourceContext);

/** Binding reference stored in a component document, by name. */
export function bindingIdOf(bindings: Record<string, unknown> | undefined, name: string): string | null {
  const reference = bindings?.[name] as { sourceType?: string; sourceId?: string } | undefined;
  return reference?.sourceType === 'dataset' && typeof reference.sourceId === 'string' ? reference.sourceId : null;
}

export type BindingState = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  response: BindingResponse | null;
  /** True while a newer request is in flight and `response` is the previous (stale) one. */
  refreshing: boolean;
  error: ApiError | null;
};

const NUMERIC = new Set(['INTEGER', 'DECIMAL', 'NUMBER', 'FLOAT', 'DOUBLE']);

/** Aggregates cross the JSON boundary as strings; restore numbers using the column types CORECROW returned. */
export function analyticsRows(response: Pick<BindingResponse, 'columns' | 'rows'>): AnalyticsRow[] {
  return response.rows.map((row) => Object.fromEntries(response.columns.map((column) => {
    const raw = row[column.key];
    const value: AnalyticsValue = NUMERIC.has(column.type.toUpperCase()) && typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : (raw as AnalyticsValue) ?? null;
    return [column.key, value];
  })));
}

export function comparisonRows(response: BindingResponse): AnalyticsRow[] | null {
  return response.comparison ? analyticsRows({ columns: response.columns, rows: response.comparison.rows }) : null;
}

type Action = { type: 'start'; keepPrevious: boolean } | { type: 'ok'; response: BindingResponse } | { type: 'fail'; error: ApiError } | { type: 'idle' };

function reduce(state: BindingState, action: Action): BindingState {
  if (action.type === 'idle') return { status: 'idle', response: null, refreshing: false, error: null };
  if (action.type === 'start') return action.keepPrevious && state.response ? { ...state, refreshing: true, error: null } : { status: 'loading', response: null, refreshing: false, error: null };
  if (action.type === 'ok') return { status: 'ready', response: action.response, refreshing: false, error: null };
  return { status: 'error', response: null, refreshing: false, error: action.error };
}

const asApiError = (reason: unknown) => reason instanceof ApiError ? reason : new ApiError(0, reason instanceof Error ? reason.message : 'Analytics binding query failed');

/**
 * Fetches one named binding. The previous result stays on screen (dimmed through `refreshing`) while a filter, sort or
 * page change loads; failures drop the data (fail closed).
 */
export function useBindingResult(bindingId: string | null, request: BindingRequest = {}): BindingState & { reload: () => void } {
  const source = useBindingSource();
  const [state, dispatch] = useReducer(reduce, { status: 'idle', response: null, refreshing: false, error: null } as BindingState);
  const [reloads, bump] = useReducer((value: number) => value + 1, 0);
  const requestJson = JSON.stringify(request);
  // Read live on every render: the source is stable, so its own filters are the dependency, not its identity.
  const filtersJson = JSON.stringify(source && bindingId ? source.filtersFor(bindingId) : []);
  const version = source?.version ?? 0;
  const latest = useRef(0);

  useEffect(() => {
    if (!source || !bindingId) { dispatch({ type: 'idle' }); return; }
    const controller = new AbortController();
    const id = ++latest.current;
    dispatch({ type: 'start', keepPrevious: true });
    const parsed = JSON.parse(requestJson) as BindingRequest;
    const merged: BindingRequest = { ...parsed, filters: [...(JSON.parse(filtersJson) as DatasetQueryFilter[]), ...(parsed.filters ?? [])] };
    source.fetch(bindingId, merged, controller.signal)
      .then((response) => { if (latest.current === id) { dispatch({ type: 'ok', response }); source.report?.(bindingId, response); } })
      .catch((reason: unknown) => { if (!controller.signal.aborted && latest.current === id) dispatch({ type: 'fail', error: asApiError(reason) }); });
    return () => controller.abort();
  }, [bindingId, filtersJson, reloads, requestJson, source, version]);

  return { ...state, reload: bump };
}
