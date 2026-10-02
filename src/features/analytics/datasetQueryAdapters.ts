import type { AnalyticsColumn, AnalyticsData, AnalyticsResult, AnalyticsRow, AnalyticsSeries, AnalyticsValue } from './types';
import type { DatasetQueryColumn, DatasetQueryResponse } from './datasetQuery';

function isNumeric(column: DatasetQueryColumn): boolean {
  return ['NUMBER', 'INTEGER', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(column.type.toUpperCase());
}

function analyticsValue(value: unknown, column: DatasetQueryColumn): AnalyticsValue {
  if (isNumeric(column) && typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && (column.type.toUpperCase() !== 'INTEGER' || Number.isSafeInteger(parsed))) return parsed;
  }
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : null;
}

function toAnalyticsColumn(column: DatasetQueryColumn): AnalyticsColumn {
  return {
    key: column.key,
    label: column.key,
    align: isNumeric(column) ? 'right' : 'left',
  };
}

/**
 * Pure adapter: values are never aggregated or derived in NORTH. PostgreSQL
 * aggregate integers/decimals may cross the JSON boundary as strings, so the
 * authoritative response column type is used to restore finite chart values.
 */
export function datasetQueryToAnalyticsData(response: DatasetQueryResponse): AnalyticsData {
  return {
    columns: response.columns.map(toAnalyticsColumn),
    rows: response.rows.map((row): AnalyticsRow => Object.fromEntries(
      response.columns.map((column) => [column.key, analyticsValue(row[column.key], column)]),
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
