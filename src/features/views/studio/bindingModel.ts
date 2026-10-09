// Maps a panel analytics binding (authoritative, server-owned query) to the result columns a component may read, and
// proposes a compatible visual configuration. Columns are derived from the *declared query* (group-by field ids and
// measure aliases are exactly the keys CORECROW returns), so nothing is guessed and no query is executed to learn them.
// Framework-free and unit-tested with `node --test`.

export type FieldKind = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
export interface FieldInfo { label: string; type: FieldKind }

export type BindingQuery =
  | { mode: 'ROWS'; fields: string[] }
  | { mode: 'AGGREGATE'; groupBy?: string[]; measures: Array<{ alias: string; operation: string; fieldId?: string }> };

export interface BindingLike { id: string; datasetId: string; name: string; query: BindingQuery }

export interface ResultColumn { key: string; label: string; role: 'dimension' | 'measure' | 'field'; numeric: boolean }

const isNumber = (type?: FieldKind) => type === 'INTEGER' || type === 'DECIMAL';

export function bindingColumns(binding: BindingLike, fields: ReadonlyMap<string, FieldInfo>): ResultColumn[] {
  const query = binding.query;
  if (query.mode === 'ROWS') {
    return query.fields.map((fieldId) => {
      const info = fields.get(fieldId);
      return { key: fieldId, label: info?.label ?? fieldId, role: 'field' as const, numeric: isNumber(info?.type) };
    });
  }
  const dimensions = (query.groupBy ?? []).map((fieldId) => {
    const info = fields.get(fieldId);
    return { key: fieldId, label: info?.label ?? fieldId, role: 'dimension' as const, numeric: false };
  });
  const measures = query.measures.map((measure) => {
    const source = measure.fieldId ? fields.get(measure.fieldId) : undefined;
    // COUNT-like and SUM/AVG always yield numbers; MIN/MAX keep the source type.
    const numeric = ['COUNT', 'COUNT_DISTINCT', 'SUM', 'AVG'].includes(measure.operation) || isNumber(source?.type);
    // Readable label ("SUM(Monto)") instead of the machine alias; the key stays the alias CORECROW returns.
    const label = measure.fieldId ? `${measure.operation}(${source?.label ?? measure.fieldId})` : measure.operation;
    return { key: measure.alias, label, role: 'measure' as const, numeric };
  });
  return [...dimensions, ...measures];
}

export type Compatibility = 'ok' | 'NO_NUMERIC' | 'NO_DIMENSION';

const localizedLabel = (label: string) => ({ es: label, en: label });

/** Visual props to apply when a binding is attached, or why the binding cannot feed this component. */
export function suggestProps(type: string, columns: ReadonlyArray<ResultColumn>): { compatibility: Compatibility; props: Record<string, unknown> } {
  const numeric = columns.filter((column) => column.numeric && column.role !== 'dimension');
  const categories = columns.filter((column) => column.role === 'dimension' || !column.numeric);
  if (type === 'metric') {
    return numeric.length ? { compatibility: 'ok', props: { fieldKey: numeric[0]!.key } } : { compatibility: 'NO_NUMERIC', props: {} };
  }
  if (type === 'bar_chart' || type === 'line_chart') {
    if (!categories.length) return { compatibility: 'NO_DIMENSION', props: {} };
    if (!numeric.length) return { compatibility: 'NO_NUMERIC', props: {} };
    return {
      compatibility: 'ok',
      props: { categoryKey: categories[0]!.key, series: numeric.slice(0, 12).map((column) => ({ key: column.key, label: localizedLabel(column.label) })) },
    };
  }
  if (type === 'donut_chart') {
    if (!categories.length) return { compatibility: 'NO_DIMENSION', props: {} };
    if (!numeric.length) return { compatibility: 'NO_NUMERIC', props: {} };
    return { compatibility: 'ok', props: { categoryKey: categories[0]!.key, valueKey: numeric[0]!.key } };
  }
  // Tables (and any future data component) render every column of the binding as-is.
  return { compatibility: 'ok', props: {} };
}

/** Which of a component's mapped keys no longer exist in the binding's columns (renamed/removed measures). */
export function staleKeys(type: string, props: Record<string, unknown>, columns: ReadonlyArray<ResultColumn>): string[] {
  const available = new Set(columns.map((column) => column.key));
  const keys: string[] = [];
  if (typeof props.fieldKey === 'string' && type === 'metric') keys.push(props.fieldKey);
  if (typeof props.categoryKey === 'string') keys.push(props.categoryKey);
  if (typeof props.valueKey === 'string') keys.push(props.valueKey);
  if (Array.isArray(props.series)) for (const item of props.series) if (item && typeof (item as { key?: unknown }).key === 'string') keys.push((item as { key: string }).key);
  return keys.filter((key) => !available.has(key));
}

/** Machine alias CORECROW accepts (^[a-z][a-z0-9_]{0,63}$), readable in column lists: sum_monto. */
export const measureAlias = (operation: string, label: string | undefined) => {
  if (operation === 'COUNT' || !label) return operation === 'COUNT' ? 'total' : operation.toLowerCase();
  const slug = label.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${operation.toLowerCase()}_${slug || 'value'}`.slice(0, 64);
};
