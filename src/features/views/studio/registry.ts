// Component registry for the Views Studio. Each entry is a *contract*: category, default size per breakpoint, the
// binding kind it accepts and which property groups the inspector exposes. The authoritative schema lives in CORECROW
// (`content-schema.ts`, strict); this list never invents a prop that schema would reject. Framework-free (icons are
// resolved in the UI layer by `iconKey`) and unit-tested with `node --test`.

import type { ComponentType } from '@/lib/northAdmin';

export type StudioCategory = 'layout' | 'content' | 'metrics' | 'charts' | 'data' | 'advanced';
export type BindingKind = 'none' | 'optional' | 'required';

export interface ComponentDefinition {
  type: ComponentType;
  category: StudioCategory;
  iconKey: string;
  /** Default grid size on desktop; tablet/mobile derive from it (see `defaultSizes`). */
  size: { w: number; h: number };
  /** `required`: renders nothing until a binding exists (charts); `optional`: static or bound (metric, table). */
  binding: BindingKind;
  /** Whether the library may add it today. Assets need object storage + scanner, which CORECROW keeps fail-closed. */
  addable: boolean;
  /** Named bindings the component reads besides `data` (e.g. `total` for a share, `trend` for sparklines). */
  slots?: string[];
  /** Inspector property groups that apply. */
  appearance: Array<'variant' | 'align' | 'level' | 'size' | 'spacing' | 'height' | 'color' | 'orientation' | 'stacking' | 'chartVariant' | 'striped' | 'ordered' | 'newTab'>;
}

const DEFINITIONS: ComponentDefinition[] = [
  { type: 'heading', category: 'content', iconKey: 'heading', size: { w: 12, h: 1 }, binding: 'none', addable: true, appearance: ['level', 'align', 'variant'] },
  { type: 'rich_text', category: 'content', iconKey: 'richText', size: { w: 12, h: 2 }, binding: 'none', addable: true, appearance: ['variant'] },
  { type: 'card', category: 'content', iconKey: 'card', size: { w: 4, h: 2 }, binding: 'none', addable: true, appearance: ['variant'] },
  { type: 'link', category: 'content', iconKey: 'link', size: { w: 4, h: 1 }, binding: 'none', addable: true, appearance: ['variant', 'size', 'newTab'] },
  { type: 'list', category: 'content', iconKey: 'list', size: { w: 6, h: 3 }, binding: 'none', addable: true, appearance: ['ordered'] },
  { type: 'divider', category: 'layout', iconKey: 'divider', size: { w: 12, h: 1 }, binding: 'none', addable: true, appearance: ['variant', 'spacing'] },
  { type: 'metric', category: 'metrics', iconKey: 'metric', size: { w: 3, h: 2 }, binding: 'optional', addable: true, appearance: ['variant'] },
  { type: 'bar_chart', category: 'charts', iconKey: 'barChart', size: { w: 6, h: 6 }, binding: 'required', addable: true, appearance: ['height', 'orientation', 'stacking', 'color'] },
  { type: 'line_chart', category: 'charts', iconKey: 'lineChart', size: { w: 6, h: 6 }, binding: 'required', addable: true, appearance: ['height', 'chartVariant', 'color'] },
  { type: 'donut_chart', category: 'charts', iconKey: 'donutChart', size: { w: 4, h: 6 }, binding: 'required', addable: true, slots: ['total'], appearance: ['height', 'chartVariant', 'color'] },
  { type: 'kpi_card', category: 'metrics', iconKey: 'kpiCard', size: { w: 2, h: 2 }, binding: 'required', addable: true, slots: ['total'], appearance: [] },
  { type: 'insights', category: 'metrics', iconKey: 'insights', size: { w: 6, h: 4 }, binding: 'required', addable: true, appearance: [] },
  { type: 'geo_map', category: 'charts', iconKey: 'geoMap', size: { w: 6, h: 7 }, binding: 'required', addable: true, appearance: [] },
  { type: 'data_grid', category: 'data', iconKey: 'dataGrid', size: { w: 8, h: 14 }, binding: 'required', addable: true, slots: ['trend'], appearance: [] },
  { type: 'filter_bar', category: 'data', iconKey: 'filterBar', size: { w: 12, h: 3 }, binding: 'none', addable: true, appearance: [] },
  { type: 'table', category: 'data', iconKey: 'table', size: { w: 12, h: 5 }, binding: 'optional', addable: true, appearance: ['striped'] },
  { type: 'embed', category: 'advanced', iconKey: 'embed', size: { w: 6, h: 4 }, binding: 'none', addable: true, appearance: [] },
  { type: 'image', category: 'content', iconKey: 'image', size: { w: 4, h: 3 }, binding: 'none', addable: false, appearance: [] },
  { type: 'video', category: 'content', iconKey: 'video', size: { w: 6, h: 4 }, binding: 'none', addable: false, appearance: [] },
  { type: 'file', category: 'content', iconKey: 'file', size: { w: 4, h: 1 }, binding: 'none', addable: false, appearance: [] },
  { type: 'document_workspace', category: 'advanced', iconKey: 'documents', size: { w: 12, h: 8 }, binding: 'none', addable: false, appearance: [] },
];

const BY_TYPE = new Map(DEFINITIONS.map((definition) => [definition.type as string, definition]));

export const CATEGORY_ORDER: StudioCategory[] = ['content', 'metrics', 'charts', 'data', 'layout', 'advanced'];

export const definitionOf = (type: string): ComponentDefinition | undefined => BY_TYPE.get(type);
export const allDefinitions = (): ReadonlyArray<ComponentDefinition> => DEFINITIONS;
export const addableDefinitions = (): ComponentDefinition[] => DEFINITIONS.filter((definition) => definition.addable);

export type Device = 'desktop' | 'tablet' | 'mobile';
export const DEVICES: Device[] = ['desktop', 'tablet', 'mobile'];
/** Preview frame width in px (desktop fills the canvas). */
export const DEVICE_WIDTH: Record<Device, number | null> = { desktop: null, tablet: 768, mobile: 390 };

/** Tablet keeps the desktop width up to the 12 columns; mobile always uses the full row. */
export function defaultSizes(type: string): Record<Device, { w: number; h: number }> {
  const size = definitionOf(type)?.size ?? { w: 12, h: 2 };
  return { desktop: size, tablet: { w: Math.min(12, Math.max(size.w, 6)), h: size.h }, mobile: { w: 12, h: size.h } };
}

/** Chart/metric/table components read `bindings.data`; the renderer picks the first dataset binding by key. */
export const DATA_BINDING_KEY = 'data';

/** Components drawn by the shared analytics renderer; they read named bindings and need no per-type preview code. */
export const ANALYTICS_TYPES: ReadonlySet<string> = new Set(['kpi_card', 'data_grid', 'geo_map', 'insights']);

export function isChart(type: string): boolean {
  return type === 'bar_chart' || type === 'line_chart' || type === 'donut_chart';
}

export function acceptsBinding(type: string): boolean {
  const kind = definitionOf(type)?.binding ?? 'none';
  return kind === 'optional' || kind === 'required';
}
