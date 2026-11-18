import { apiRequest } from '@/lib/api';
import type { DatasetQueryFilter, DatasetQueryResponse } from './datasetQuery';

export type PanelBindingFilterDefinition = {
  fieldId: string;
  key: string;
  displayName: Record<string, string>;
  type: 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
  operators: DatasetQueryFilter['operator'][];
};

/** Reader-chosen paging/sorting; CORECROW re-validates every key against the binding's own outputs. */
export type BindingRuntimeOptions = {
  sort?: { key: string; direction: 'ASC' | 'DESC' };
  offset?: number;
  limit?: number;
  search?: string;
  compare?: boolean;
  /** Skip CORECROW's short-lived result cache (set after an explicit refresh). */
  fresh?: boolean;
};

export type PanelBindingQueryResult = DatasetQueryResponse & {
  bindingId: string;
  filterDefinitions: PanelBindingFilterDefinition[];
  totalRows?: number;
  comparison?: { period: { from: string; to: string }; previousPeriod: { from: string; to: string }; rows: Array<Record<string, string | number | boolean | null>> };
};

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Executes the server-owned query associated with a published panel binding.
 * The document supplies only the binding reference; CORECROW resolves the
 * dataset and query definition, authorizes the panel, and limits filters.
 */
export function queryPanelAnalyticsBinding(
  organizationId: string,
  panelId: string,
  bindingId: string,
  filters: DatasetQueryFilter[] = [],
  signal?: AbortSignal,
  options: BindingRuntimeOptions = {},
): Promise<PanelBindingQueryResult> {
  return apiRequest<PanelBindingQueryResult>(
    `/v1/organizations/${pathSegment(organizationId)}/panels/${pathSegment(panelId)}/analytics-bindings/${pathSegment(bindingId)}/results`,
    { method: 'POST', body: JSON.stringify({ filters, ...options }), signal },
  );
}

export const EXPORT_MIN_ROWS = 100;
export const EXPORT_MAX_ROWS = 10_000;

export type ExportRequest = {
  format: 'csv' | 'xlsx';
  /** Between EXPORT_MIN_ROWS and min(total, EXPORT_MAX_ROWS); CORECROW re-validates it against the real total. */
  count: number;
  filters?: DatasetQueryFilter[];
  sort?: { key: string; direction: 'ASC' | 'DESC' };
  search?: string;
  columns?: Array<{ key: string; label: string }>;
};

export type ExportResult = { format: 'csv' | 'xlsx'; filename: string; mime: string; total: number; rows: number; contentBase64: string };

/** Audited, server-built CSV/XLSX of one published binding for the reader's current selection. */
export function exportPanelAnalyticsBinding(organizationId: string, panelId: string, bindingId: string, request: ExportRequest, signal?: AbortSignal): Promise<ExportResult> {
  return apiRequest<ExportResult>(
    `/v1/organizations/${pathSegment(organizationId)}/panels/${pathSegment(panelId)}/analytics-bindings/${pathSegment(bindingId)}/export`,
    { method: 'POST', body: JSON.stringify({ filters: [], ...request }), signal },
  );
}
