import type { AnalyticsColumn, AnalyticsData, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';
import type { DatasetQueryColumn, DatasetQueryResponse } from './datasetQuery';

function analyticsValue(value: unknown): AnalyticsValue {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : null;
}

function isNumeric(column: DatasetQueryColumn): boolean {
  return ['NUMBER', 'INTEGER', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(column.type.toUpperCase());
}

function toAnalyticsColumn(column: DatasetQueryColumn): AnalyticsColumn {
  return {
    key: column.key,
    label: column.key,
    align: isNumeric(column) ? 'right' : 'left',
  };
}

/** Pure adapter: backend values are rendered as supplied and never derived in NORTH. */
export function datasetQueryToAnalyticsData(response: DatasetQueryResponse): AnalyticsData {
  return {
    columns: response.columns.map(toAnalyticsColumn),
    rows: response.rows.map((row): AnalyticsRow => Object.fromEntries(
      response.columns.map((column) => [column.key, analyticsValue(row[column.key])]),
    )),
  };
}

export function datasetQueryToAnalyticsResult(response: DatasetQueryResponse): AnalyticsResult {
  const data = datasetQueryToAnalyticsData(response);
  return data.rows.length === 0 ? { state: 'empty' } : { state: 'ready', data };
}

/**
 * Keeps presentation configuration separate from query authorization. A
 * caller may restrict series keys, but unknown or non-numeric columns are
 * deliberately omitted rather than guessed.
 */
export function datasetQueryToAnalyticsSeries(
  response: DatasetQueryResponse,
  keys?: readonly string[],
): AnalyticsSeries[] {
  const selected = keys ? new Set(keys) : undefined;
  return response.columns
    .filter((column) => isNumeric(column) && (!selected || selected.has(column.key)))
    .map((column) => ({ key: column.key, label: column.key }));
}

/** First categorical response column, useful only as a presentation default. */
export function datasetQueryCategoryKey(response: DatasetQueryResponse): string | null {
  return response.columns.find((column) => !isNumeric(column))?.key ?? null;
}
