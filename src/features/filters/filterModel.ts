// Pure model of the universal filter engine. A *definition* comes from CORECROW (what a published binding allows);
// a *selection* is what the person picked. `selectionToFilters` is the only place that turns one into the other, and it
// emits only operators the definition allows, so a runtime filter can never be rejected for policy reasons.
import type { DatasetQueryFilter } from '@/features/analytics/datasetQuery';
import type { PanelBindingFilterDefinition } from '@/features/analytics/panelBindingQuery';

export type FilterScalar = string | number | boolean;
export type FilterSelection = { values?: FilterScalar[]; text?: string; from?: string; to?: string };
export type FilterSelections = Record<string, FilterSelection>;
export type FilterMode = 'multi' | 'single' | 'text' | 'range' | 'none';
type Definition = Pick<PanelBindingFilterDefinition, 'fieldId' | 'type' | 'operators'>;

/** Which control a field gets. Categorical fields prefer a faceted list (real values); dates/decimals prefer ranges. */
export function filterModeOf(definition: Definition): FilterMode {
  const ops = new Set(definition.operators);
  const rangeOps = ops.has('GTE') || ops.has('LTE') || ops.has('GT') || ops.has('LT');
  if (definition.type === 'DATE' || definition.type === 'DATETIME' || definition.type === 'DECIMAL') {
    if (rangeOps) return 'range';
    if (ops.has('EQ')) return 'single';
    return 'none';
  }
  if (ops.has('IN')) return 'multi';
  if (ops.has('EQ')) return 'single';
  if (definition.type === 'TEXT' && ops.has('CONTAINS')) return 'text';
  if (rangeOps) return 'range';
  return 'none';
}

export const isSelectionActive = (selection: FilterSelection | undefined) =>
  Boolean(selection && ((selection.values?.length ?? 0) > 0 || selection.text?.trim() || selection.from || selection.to));

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const dayStart = (value: string, type: Definition['type']) => (type === 'DATETIME' && isDay(value) ? `${value}T00:00:00.000Z` : value);
const dayEnd = (value: string, type: Definition['type']) => (type === 'DATETIME' && isDay(value) ? `${value}T23:59:59.999Z` : value);

export function selectionToFilters(definition: Definition, selection: FilterSelection | undefined): DatasetQueryFilter[] {
  if (!selection || !isSelectionActive(selection)) return [];
  const ops = new Set(definition.operators);
  const { fieldId } = definition;
  const out: DatasetQueryFilter[] = [];
  const values = selection.values ?? [];
  if (values.length) {
    if (values.length > 1 && ops.has('IN')) out.push({ fieldId, operator: 'IN', value: values.slice(0, 100) });
    else if (ops.has('EQ')) out.push({ fieldId, operator: 'EQ', value: values[0]! });
    else if (ops.has('IN')) out.push({ fieldId, operator: 'IN', value: values.slice(0, 100) });
  }
  const text = selection.text?.trim();
  if (text) {
    if (ops.has('CONTAINS')) out.push({ fieldId, operator: 'CONTAINS', value: text });
    else if (ops.has('EQ')) out.push({ fieldId, operator: 'EQ', value: text });
  }
  if (selection.from) {
    if (ops.has('GTE')) out.push({ fieldId, operator: 'GTE', value: dayStart(selection.from, definition.type) });
    else if (ops.has('GT')) out.push({ fieldId, operator: 'GT', value: dayStart(selection.from, definition.type) });
  }
  if (selection.to) {
    if (ops.has('LTE')) out.push({ fieldId, operator: 'LTE', value: dayEnd(selection.to, definition.type) });
    else if (ops.has('LT')) out.push({ fieldId, operator: 'LT', value: dayEnd(selection.to, definition.type) });
  }
  return out;
}

/** The filters one binding receives: every active selection translated through THAT binding's own definitions. */
export function filtersForDefinitions(definitions: Definition[], selections: FilterSelections, exceptFieldId?: string): DatasetQueryFilter[] {
  return definitions
    .filter((definition) => definition.fieldId !== exceptFieldId)
    .flatMap((definition) => selectionToFilters(definition, selections[definition.fieldId]))
    .slice(0, 10);
}

export function toggleValue(selection: FilterSelection | undefined, value: FilterScalar, multi: boolean): FilterSelection {
  const current = selection?.values ?? [];
  const has = current.some((item) => item === value);
  const values = has ? current.filter((item) => item !== value) : multi ? [...current, value] : [value];
  return { ...selection, values };
}

export type FilterChip = { key: string; fieldId: string; part: 'value' | 'text' | 'from' | 'to'; value?: FilterScalar; text: string };

/** Removable chips for every active part of every selection, in a stable order (definition order, then part). */
export function chipsOf(definitions: Array<Definition & { label: string }>, selections: FilterSelections, format: (value: FilterScalar) => string = String): FilterChip[] {
  return definitions.flatMap((definition) => {
    const selection = selections[definition.fieldId];
    if (!selection) return [];
    const chips: FilterChip[] = [];
    for (const value of selection.values ?? []) chips.push({ key: `${definition.fieldId}:v:${String(value)}`, fieldId: definition.fieldId, part: 'value', value, text: `${definition.label}: ${format(value)}` });
    if (selection.text?.trim()) chips.push({ key: `${definition.fieldId}:t`, fieldId: definition.fieldId, part: 'text', text: `${definition.label} ∋ ${selection.text.trim()}` });
    if (selection.from) chips.push({ key: `${definition.fieldId}:f`, fieldId: definition.fieldId, part: 'from', text: `${definition.label} ≥ ${selection.from}` });
    if (selection.to) chips.push({ key: `${definition.fieldId}:to`, fieldId: definition.fieldId, part: 'to', text: `${definition.label} ≤ ${selection.to}` });
    return chips;
  });
}

export function removeChip(selections: FilterSelections, chip: FilterChip): FilterSelections {
  const selection = selections[chip.fieldId];
  if (!selection) return selections;
  const next: FilterSelection = { ...selection };
  if (chip.part === 'value') next.values = (selection.values ?? []).filter((item) => item !== chip.value);
  else if (chip.part === 'text') delete next.text;
  else if (chip.part === 'from') delete next.from;
  else delete next.to;
  const rest = { ...selections };
  delete rest[chip.fieldId];
  return isSelectionActive(next) ? { ...rest, [chip.fieldId]: next } : rest;
}

export const activeCount = (selections: FilterSelections) => Object.values(selections).filter(isSelectionActive).length;

// Selections are restored when the person comes back to the same panel in the same browser session
// (sessionStorage is cleared on sign-out). The shape is validated on read; anything else is dropped.
const storageKey = (panelId: string) => `north-filters-v1:${panelId}`;
export function loadSelections(panelId: string): FilterSelections {
  try {
    const raw = JSON.parse(sessionStorage.getItem(storageKey(panelId)) ?? '{}') as unknown;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out: FilterSelections = {};
    for (const [fieldId, value] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
      if (!value || typeof value !== 'object') continue;
      const v = value as Record<string, unknown>;
      const values = Array.isArray(v.values) ? v.values.filter((x): x is FilterScalar => ['string', 'number', 'boolean'].includes(typeof x)).slice(0, 100) : undefined;
      const selection: FilterSelection = {
        ...(values?.length ? { values } : {}),
        ...(typeof v.text === 'string' && v.text ? { text: v.text.slice(0, 200) } : {}),
        ...(typeof v.from === 'string' && v.from ? { from: v.from.slice(0, 40) } : {}),
        ...(typeof v.to === 'string' && v.to ? { to: v.to.slice(0, 40) } : {}),
      };
      if (isSelectionActive(selection)) out[fieldId] = selection;
    }
    return out;
  } catch { return {}; }
}

export function saveSelections(panelId: string, selections: FilterSelections) {
  try {
    if (activeCount(selections)) sessionStorage.setItem(storageKey(panelId), JSON.stringify(selections));
    else sessionStorage.removeItem(storageKey(panelId));
  } catch { /* storage unavailable */ }
}
