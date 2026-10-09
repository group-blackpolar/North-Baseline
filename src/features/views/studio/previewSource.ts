import { queryDataset, type DatasetQueryRequest } from '@/features/analytics/datasetQuery';
import type { BindingRequest, BindingResponse, BindingSource } from '@/features/analytics/pro/bindingSource';
import type { PanelBinding } from './studioApi';

type Declared = Record<string, unknown> & { mode: 'ROWS' | 'AGGREGATE'; limit?: number };

/**
 * Design-time source for the Studio canvas. The editor is authorized to query the dataset, so each binding's declared query
 * runs directly (published pages go through the authorized binding endpoint instead). Reader-only options that the direct
 * query does not know — filters, comparison — are not applied: a preview shows the unfiltered result.
 */
export function previewQuery(declared: Declared, request: BindingRequest): DatasetQueryRequest {
  const { searchFieldIds, compareBy: _compareBy, ...base } = declared as Declared & { searchFieldIds?: string[]; compareBy?: string };
  const query: Record<string, unknown> = { ...base };
  if (request.sort) query.orderBy = declared.mode === 'ROWS' ? [{ fieldId: request.sort.key, direction: request.sort.direction }] : [{ key: request.sort.key, direction: request.sort.direction }];
  if (request.offset !== undefined) query.offset = request.offset;
  if (request.limit !== undefined) query.limit = Math.min(request.limit, declared.limit ?? 100);
  if (request.search && searchFieldIds?.length) query.search = { fieldIds: searchFieldIds, text: request.search };
  return query as unknown as DatasetQueryRequest;
}

export function makePreviewSource(organizationId: string, bindings: ReadonlyArray<PanelBinding>): BindingSource {
  return {
    version: 0,
    filtersFor: () => [],
    fetch: async (bindingId, request, signal) => {
      const binding = bindings.find((item) => item.id === bindingId);
      if (!binding) throw new Error('Binding not found');
      const response = await queryDataset(organizationId, binding.datasetId, previewQuery(binding.query as unknown as Declared, request), signal);
      return { ...response, executedAt: response.executedAt, totalRows: (response as { totalRows?: number }).totalRows } as BindingResponse;
    },
  };
}
