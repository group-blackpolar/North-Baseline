import { apiRequest } from '@/lib/api';
import type { DatasetQueryFilter } from '@/features/analytics/datasetQuery';

export type FacetValue = { value: string | number | boolean | null; count: number };
export type FacetResult = { bindingId: string; fieldId: string; values: FacetValue[]; truncated: boolean; executedAt: string };

/**
 * Distinct values (with counts) of one allowlisted filter field of a published binding. CORECROW applies the same
 * panel/audience authorization as the binding results, the binding's own filters and every OTHER runtime filter;
 * the field's own selection is excluded so sibling values stay selectable.
 */
export function queryPanelFacet(
  organizationId: string,
  panelId: string,
  bindingId: string,
  input: { fieldId: string; search?: string; filters: DatasetQueryFilter[]; limit?: number },
  signal?: AbortSignal,
): Promise<FacetResult> {
  const path = [organizationId, panelId, bindingId].map(encodeURIComponent);
  return apiRequest<FacetResult>(
    `/v1/organizations/${path[0]}/panels/${path[1]}/analytics-bindings/${path[2]}/facets`,
    { method: 'POST', body: JSON.stringify({ limit: 50, ...input }), signal },
  );
}
