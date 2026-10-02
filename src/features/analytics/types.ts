export type AnalyticsValue = string | number | boolean | null;
export type AnalyticsRow = Record<string, AnalyticsValue>;

export type AnalyticsColumn = {
  key: string;
  label: string;
  align?: 'left' | 'right';
};

export type AnalyticsData = {
  columns: AnalyticsColumn[];
  rows: AnalyticsRow[];
};

/**
 * Contract owned by the future CORECROW analytics endpoints. NORTH renders the
 * supplied result only; it never supplies records, computes tenant data, or
 * treats a client-side result as authorization.
 */
export type AnalyticsResult =
  | { state: 'loading' }
  | { state: 'error'; message?: string }
  | { state: 'empty'; message?: string }
  | { state: 'ready'; data: AnalyticsData };

export type AnalyticsSeries = {
  key: string;
  label: string;
  color?: string;
};

export type AnalyticsFilterOption = { value: string; label: string };
export type AnalyticsFilter = {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'date' | 'text';
  value: string | string[];
  options?: AnalyticsFilterOption[];
  disabled?: boolean;
};
