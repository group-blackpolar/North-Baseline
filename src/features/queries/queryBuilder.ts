// Query Explorer model. It builds the *declarative* dataset query CORECROW already exposes
// (`POST /v1/organizations/:id/datasets/:id/query`): no SQL, no scripts, only allowlisted modes, operators and field ids.
// CORECROW re-validates and authorizes everything (tenant, dataset ACL, limits, active revision, audit); this module only
// keeps the UI from composing requests the contract would reject. Framework-free, unit-tested with `node --test`.

export type FieldType = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
export type Operator = 'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS';
/** UI operators. `BETWEEN` is sent as GTE+LTE; `IS_NULL`/`IS_NOT_NULL` as EQ/NE with a null value (both in the contract). */
export type UiOperator = Operator | 'BETWEEN' | 'IS_NULL' | 'IS_NOT_NULL';
export type Measure = 'COUNT' | 'COUNT_DISTINCT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';

export interface QueryField { id: string; key: string; label: string; type: FieldType }

export const MAX_FILTERS = 10;
export const MAX_ROW_FIELDS = 20;
export const MAX_ROWS = 200;
export const MAX_AGGREGATE_ROWS = 100;
export const MAX_GROUPS = 2;
export const MAX_MEASURES = 8;

const NUMERIC: FieldType[] = ['INTEGER', 'DECIMAL'];
const ORDERED: FieldType[] = ['INTEGER', 'DECIMAL', 'DATE', 'DATETIME', 'TIME'];

/** Operators offered for a field type — never an operator the type cannot take. */
export function operatorsFor(type: FieldType): UiOperator[] {
  if (type === 'TEXT') return ['EQ', 'NE', 'CONTAINS', 'IS_NULL', 'IS_NOT_NULL'];
  if (type === 'BOOLEAN') return ['EQ', 'NE', 'IS_NULL', 'IS_NOT_NULL'];
  return ['EQ', 'NE', 'GT', 'GTE', 'LT', 'LTE', 'BETWEEN', 'IS_NULL', 'IS_NOT_NULL'];
}

export function measuresFor(type: FieldType | null): Measure[] {
  if (type === null) return ['COUNT'];
  if (NUMERIC.includes(type)) return ['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG', 'MIN', 'MAX'];
  if (ORDERED.includes(type)) return ['COUNT', 'COUNT_DISTINCT', 'MIN', 'MAX'];
  return ['COUNT', 'COUNT_DISTINCT'];
}

export interface FilterDraft { id: string; fieldId: string; operator: UiOperator; value: string; value2: string }
export interface MeasureDraft { id: string; operation: Measure; fieldId: string; alias: string }
export interface BuilderState {
  mode: 'ROWS' | 'AGGREGATE';
  fields: string[];
  filters: FilterDraft[];
  orderBy: Array<{ key: string; direction: 'ASC' | 'DESC' }>;
  groupBy: string[];
  measures: MeasureDraft[];
  limit: number;
}

export const emptyBuilder = (): BuilderState => ({ mode: 'ROWS', fields: [], filters: [], orderBy: [], groupBy: [], measures: [], limit: 50 });

export type DatasetQueryRequest =
  | { mode: 'ROWS'; fields: string[]; filters?: Array<{ fieldId: string; operator: Operator; value: string | number | boolean | null }>; orderBy?: Array<{ fieldId: string; direction: 'ASC' | 'DESC' }>; limit: number; offset: number }
  | { mode: 'AGGREGATE'; groupBy?: string[]; measures: Array<{ operation: Measure; fieldId?: string; alias: string }>; filters?: Array<{ fieldId: string; operator: Operator; value: string | number | boolean | null }>; orderBy?: Array<{ key: string; direction: 'ASC' | 'DESC' }>; limit: number };

export type BuildResult = { ok: true; request: DatasetQueryRequest } | { ok: false; errors: string[] };

function coerce(type: FieldType, raw: string): string | number | boolean | null | undefined {
  const value = raw.trim();
  if (type === 'BOOLEAN') return value === 'true' ? true : value === 'false' ? false : undefined;
  if (value === '') return undefined;
  if (type === 'INTEGER') return /^-?\d+$/.test(value) ? Number(value) : undefined;
  if (type === 'DECIMAL') return /^-?(?:\d+\.?\d*|\.\d+)$/.test(value) ? Number(value) : undefined;
  if (type === 'DATE') return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
  if (type === 'TIME') return /^\d{2}:\d{2}(?::\d{2})?$/.test(value) ? value : undefined;
  if (type === 'DATETIME') return Number.isNaN(Date.parse(value)) ? undefined : value;
  return value.length <= 4096 ? value : undefined;
}

type ApiFilter = { fieldId: string; operator: Operator; value: string | number | boolean | null };

/** Error codes (not prose) so the UI can localize them. */
export function buildQuery(state: BuilderState, fields: QueryField[]): BuildResult {
  const errors: string[] = [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  const filters: ApiFilter[] = [];

  for (const draft of state.filters) {
    const field = byId.get(draft.fieldId);
    if (!field) { errors.push('FILTER_FIELD'); continue; }
    if (!operatorsFor(field.type).includes(draft.operator)) { errors.push('FILTER_OPERATOR'); continue; }
    if (draft.operator === 'IS_NULL') { filters.push({ fieldId: field.id, operator: 'EQ', value: null }); continue; }
    if (draft.operator === 'IS_NOT_NULL') { filters.push({ fieldId: field.id, operator: 'NE', value: null }); continue; }
    const first = coerce(field.type, draft.value);
    if (first === undefined || first === null) { errors.push('FILTER_VALUE'); continue; }
    if (draft.operator === 'BETWEEN') {
      const second = coerce(field.type, draft.value2);
      if (second === undefined || second === null) { errors.push('FILTER_VALUE'); continue; }
      filters.push({ fieldId: field.id, operator: 'GTE', value: first }, { fieldId: field.id, operator: 'LTE', value: second });
      continue;
    }
    filters.push({ fieldId: field.id, operator: draft.operator, value: first });
  }
  if (filters.length > MAX_FILTERS) errors.push('TOO_MANY_FILTERS');

  if (state.mode === 'ROWS') {
    if (state.fields.length === 0) errors.push('NO_FIELDS');
    if (state.fields.length > MAX_ROW_FIELDS) errors.push('TOO_MANY_FIELDS');
    if (new Set(state.fields).size !== state.fields.length) errors.push('DUPLICATE_FIELDS');
    if (state.fields.some((id) => !byId.has(id))) errors.push('UNKNOWN_FIELD');
    const order = state.orderBy.filter((item) => item.key);
    if (order.some((item) => !state.fields.includes(item.key) && !byId.has(item.key))) errors.push('ORDER_FIELD');
    if (new Set(order.map((item) => item.key)).size !== order.length || order.length > 3) errors.push('ORDER_LIMIT');
    if (errors.length) return { ok: false, errors: [...new Set(errors)] };
    return {
      ok: true,
      request: {
        mode: 'ROWS', fields: state.fields, ...(filters.length ? { filters } : {}),
        ...(order.length ? { orderBy: order.map((item) => ({ fieldId: item.key, direction: item.direction })) } : {}),
        limit: Math.min(MAX_ROWS, Math.max(1, Math.trunc(state.limit) || 50)), offset: 0,
      },
    };
  }

  if (state.measures.length === 0) errors.push('NO_MEASURES');
  if (state.measures.length > MAX_MEASURES) errors.push('TOO_MANY_MEASURES');
  if (state.groupBy.length > MAX_GROUPS) errors.push('TOO_MANY_GROUPS');
  if (new Set(state.groupBy).size !== state.groupBy.length || state.groupBy.some((id) => !byId.has(id))) errors.push('GROUP_FIELD');
  const aliases = state.measures.map((measure) => measure.alias);
  if (new Set(aliases).size !== aliases.length || aliases.some((alias) => !/^[a-z][a-z0-9_]{0,63}$/.test(alias))) errors.push('MEASURE_ALIAS');
  const measures: Array<{ operation: Measure; fieldId?: string; alias: string }> = [];
  for (const measure of state.measures) {
    const field = measure.fieldId ? byId.get(measure.fieldId) : undefined;
    if (measure.operation !== 'COUNT' && !field) { errors.push('MEASURE_FIELD'); continue; }
    if (field && !measuresFor(field.type).includes(measure.operation)) { errors.push('MEASURE_TYPE'); continue; }
    measures.push({ operation: measure.operation, ...(field ? { fieldId: field.id } : {}), alias: measure.alias });
  }
  const outputs = new Set([...state.groupBy, ...aliases]);
  const order = state.orderBy.filter((item) => item.key);
  if (order.some((item) => !outputs.has(item.key))) errors.push('ORDER_OUTPUT');
  if (new Set(order.map((item) => item.key)).size !== order.length || order.length > 3) errors.push('ORDER_LIMIT');
  if (errors.length) return { ok: false, errors: [...new Set(errors)] };
  return {
    ok: true,
    request: {
      mode: 'AGGREGATE', ...(state.groupBy.length ? { groupBy: state.groupBy } : {}), measures, ...(filters.length ? { filters } : {}),
      ...(order.length ? { orderBy: order.map((item) => ({ key: item.key, direction: item.direction })) } : {}),
      limit: Math.min(MAX_AGGREGATE_ROWS, Math.max(1, Math.trunc(state.limit) || 50)),
    },
  };
}

export type Cell = string | number | boolean | null;
export interface ResultColumn { key: string; fieldId?: string; type: FieldType }

export interface ColumnStats { key: string; type: FieldType; count: number; nulls: number; distinct: number; min?: number | string; max?: number | string; mean?: number; sum?: number }

/** Basic statistics over the rows already returned (never a second query, never claims to describe the full dataset). */
export function columnStats(columns: ResultColumn[], rows: Array<Record<string, Cell>>): ColumnStats[] {
  return columns.map((column) => {
    const values = rows.map((row) => row[column.key]);
    const present = values.filter((value): value is string | number | boolean => value !== null && value !== undefined && value !== '');
    const stats: ColumnStats = { key: column.key, type: column.type, count: present.length, nulls: values.length - present.length, distinct: new Set(present).size };
    if (column.type === 'INTEGER' || column.type === 'DECIMAL') {
      const numbers = present.map(Number).filter((value) => Number.isFinite(value));
      if (numbers.length) {
        const sum = numbers.reduce((total, value) => total + value, 0);
        stats.min = Math.min(...numbers); stats.max = Math.max(...numbers); stats.sum = sum; stats.mean = sum / numbers.length;
      }
    } else if (column.type === 'DATE' || column.type === 'DATETIME' || column.type === 'TIME') {
      const sorted = present.map(String).sort();
      if (sorted.length) { stats.min = sorted[0]; stats.max = sorted[sorted.length - 1]; }
    }
    return stats;
  });
}

/** A chart is only offered when the result actually has a label column and a numeric column. */
export function chartableShape(columns: ResultColumn[], rows: unknown[]): { label: ResultColumn; value: ResultColumn } | null {
  if (rows.length < 2 || rows.length > 100) return null;
  const value = [...columns].reverse().find((column) => column.type === 'INTEGER' || column.type === 'DECIMAL');
  const label = columns.find((column) => column !== value && (column.type === 'TEXT' || column.type === 'DATE' || column.type === 'BOOLEAN' || column.type === 'DATETIME'));
  return label && value ? { label, value } : null;
}

/** "ventas totales" -> "ventas_totales"; always a valid measure alias. */
export function aliasFrom(label: string, taken: string[]): string {
  const base = label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').replace(/^[^a-z]+/, '') || 'measure';
  let alias = base.slice(0, 60); let index = 2;
  while (taken.includes(alias)) alias = `${base.slice(0, 56)}_${index++}`;
  return alias;
}
