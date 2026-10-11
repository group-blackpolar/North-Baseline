// UI directives the assistant's tools can ask NORTH to perform (open a dashboard, apply or clear filters). They arrive inside
// `tool.completed` events and are validated HERE again: only these three shapes with bounded fields are ever executed, so a
// compromised or confused model/tool result can never make the client do anything else. Pure and unit-tested with `node --test`.

export type FilterDirective = { fieldKey: string; values?: Array<string | number | boolean>; text?: string; from?: string; to?: string };
export type UiDirective =
  | { type: 'open_panel'; panelId: string }
  | { type: 'apply_filters'; panelId: string; replace: boolean; filters: FilterDirective[] }
  | { type: 'clear_filters'; panelId: string };

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 128;
const short = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

export function parseDirective(value: unknown): UiDirective | null {
  if (!isRecord(value) || !id(value.panelId)) return null;
  const panelId = value.panelId;
  if (value.type === 'open_panel') return { type: 'open_panel', panelId };
  if (value.type === 'clear_filters') return { type: 'clear_filters', panelId };
  if (value.type !== 'apply_filters' || !Array.isArray(value.filters) || value.filters.length === 0 || value.filters.length > 10) return null;
  const filters: FilterDirective[] = [];
  for (const raw of value.filters) {
    if (!isRecord(raw) || !short(raw.fieldKey, 128)) return null;
    const filter: FilterDirective = { fieldKey: raw.fieldKey };
    if (raw.values !== undefined) {
      if (!Array.isArray(raw.values) || raw.values.length === 0 || raw.values.length > 100 || !raw.values.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) return null;
      filter.values = raw.values as Array<string | number | boolean>;
    }
    if (raw.text !== undefined) { if (!short(raw.text, 200)) return null; filter.text = raw.text; }
    if (raw.from !== undefined) { if (!short(raw.from, 40)) return null; filter.from = raw.from; }
    if (raw.to !== undefined) { if (!short(raw.to, 40)) return null; filter.to = raw.to; }
    if (!filter.values && !filter.text && !filter.from && !filter.to) return null;
    filters.push(filter);
  }
  return { type: 'apply_filters', panelId, replace: value.replace !== false, filters };
}

type Selection = { values?: Array<string | number | boolean>; text?: string; from?: string; to?: string };

/** Directive filters (by field KEY) -> the dashboard's selections (by field id), using the controls CORECROW described. Unknown keys are dropped. */
export function selectionsFromFilters(filters: FilterDirective[], controls: Array<{ fieldId: string; key: string }>): { selections: Record<string, Selection>; unresolved: string[] } {
  const selections: Record<string, Selection> = {};
  const unresolved: string[] = [];
  for (const filter of filters) {
    const control = controls.find((item) => item.key === filter.fieldKey);
    if (!control) { unresolved.push(filter.fieldKey); continue; }
    selections[control.fieldId] = { ...(filter.values ? { values: filter.values } : {}), ...(filter.text ? { text: filter.text } : {}), ...(filter.from ? { from: filter.from } : {}), ...(filter.to ? { to: filter.to } : {}) };
  }
  return { selections, unresolved };
}
