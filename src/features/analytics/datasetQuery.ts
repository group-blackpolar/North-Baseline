import { apiRequest } from '@/lib/api';

/**
 * Typed client boundary for the dataset query API. CORECROW remains the
 * authority for tenant resolution, access control, revision selection and
 * query execution; NORTH only submits an explicitly declared query and
 * renders the returned result.
 *
 * The endpoint is intentionally not used by a published renderer yet. That
 * wiring belongs to the authoritative binding contract, once available.
 */

export type DatasetQueryValue = string | number | boolean | null;
export type DatasetQueryRow = Record<string, DatasetQueryValue>;

export type DatasetQueryColumn = {
  key: string;
  fieldId?: string;
  type: string;
};

export type DatasetQueryFilter = {
  fieldId: string;
  operator: 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS';
  value: DatasetQueryValue;
};

export type DatasetQueryOrder = {
  fieldId: string;
  direction: 'ASC' | 'DESC';
};

export type DatasetAggregateMeasure = {
  alias: string;
  fieldId?: string;
  operation: 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
};

type DatasetQueryBase = {
  filters?: DatasetQueryFilter[];
  limit?: number;
};

export type DatasetRowsQuery = DatasetQueryBase & {
  mode: 'ROWS';
  fields: string[];
  orderBy?: DatasetQueryOrder[];
  offset?: number;
};

export type DatasetAggregateQuery = DatasetQueryBase & {
  mode: 'AGGREGATE';
  groupBy?: string[];
  measures: DatasetAggregateMeasure[];
};

export type DatasetQueryRequest = DatasetRowsQuery | DatasetAggregateQuery;

type DatasetQueryResponseBase = {
  datasetId: string;
  activeRevisionId: string;
  schemaVersionId: string;
  columns: DatasetQueryColumn[];
  rows: DatasetQueryRow[];
  rowCount: number;
  executedAt: string;
};

export type DatasetRowsQueryResponse = DatasetQueryResponseBase & {
  mode: 'ROWS';
};

export type DatasetAggregateQueryResponse = DatasetQueryResponseBase & {
  mode: 'AGGREGATE';
};

export type DatasetQueryResponse = DatasetRowsQueryResponse | DatasetAggregateQueryResponse;

function pathSegment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Executes an authorized query against a specific dataset. `signal` is
 * forwarded to the shared transport so callers can cancel on tenant, dataset
 * or request changes.
 */
export function queryDataset(
  organizationId: string,
  datasetId: string,
  request: DatasetQueryRequest,
  signal?: AbortSignal,
): Promise<DatasetQueryResponse> {
  return apiRequest<DatasetQueryResponse>(
    `/v1/organizations/${pathSegment(organizationId)}/datasets/${pathSegment(datasetId)}/query`,
    {
      method: 'POST',
      body: JSON.stringify(request),
      signal,
    },
  );
}
