import { apiRequest } from '@/lib/api';
import type { DatasetQueryFilter, DatasetQueryResponse } from './datasetQuery';

export type PanelBindingFilterDefinition = {
  fieldId: string;
  key: string;
  displayName: Record<string, string>;
  type: 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
  operators: DatasetQueryFilter['operator'][];
};

export type PanelBindingQueryResult = DatasetQueryResponse & {
  bindingId: string;
  filterDefinitions: PanelBindingFilterDefinition[];
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
): Promise<PanelBindingQueryResult> {
  return apiRequest<PanelBindingQueryResult>(
    `/v1/organizations/${pathSegment(organizationId)}/panels/${pathSegment(panelId)}/analytics-bindings/${pathSegment(bindingId)}/results`,
    { method: 'POST', body: JSON.stringify({ filters }), signal },
  );
}
