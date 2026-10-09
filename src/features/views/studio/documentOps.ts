// Pure, immutable operations on a panel document. The Studio never mutates a document in place; every gesture is
// one of these functions, which makes undo/redo a matter of keeping snapshots. Nothing here talks to the network and
// nothing produces a value CORECROW's strict schema would refuse for structural reasons (geometry, ids, ordering).
// Framework-free and unit-tested with `node --test`.

import type { PanelDocument, ResponsiveLayout } from '@/lib/northAdmin';
import { appendCell, placeItem, readingOrder, type Cell, type GridItem } from './grid.ts';
import { DEVICES, defaultSizes, type Device } from './registry.ts';

export type Section = PanelDocument['sections'][number];
export type Component = Section['components'][number];

export const MAX_SECTIONS = 50;
export const MAX_COMPONENTS_PER_SECTION = 200;

export const makeId = (): string => globalThis.crypto.randomUUID();

const reindexSections = (sections: Section[]): Section[] => sections.map((section, order) => ({ ...section, order }));

/** `order` follows desktop reading order so assistive technology and the mobile stack read the page top-to-bottom. */
function normalizeOrder(section: Section): Section {
  const sorted = readingOrder(section.components, (component) => component.layout.desktop);
  return { ...section, components: sorted.map((component, order) => (component.order === order ? component : { ...component, order })) };
}

const mapSection = (doc: PanelDocument, sectionId: string, fn: (section: Section) => Section): PanelDocument => {
  let touched = false;
  const sections = doc.sections.map((section) => {
    if (section.id !== sectionId) return section;
    touched = true;
    return fn(section);
  });
  return touched ? { ...doc, sections } : doc;
};

export function findComponent(doc: PanelDocument, componentId: string): { section: Section; component: Component } | null {
  for (const section of doc.sections) {
    const component = section.components.find((item) => item.id === componentId);
    if (component) return { section, component };
  }
  return null;
}

export function newSection(): Section {
  return { id: makeId(), order: 0, layout: { variant: 'grid', gap: 'md' }, components: [] };
}

export function addSection(doc: PanelDocument, index?: number): { doc: PanelDocument; sectionId: string } | null {
  if (doc.sections.length >= MAX_SECTIONS) return null;
  const section = newSection();
  const sections = [...doc.sections];
  sections.splice(index ?? sections.length, 0, section);
  return { doc: { ...doc, sections: reindexSections(sections) }, sectionId: section.id };
}

export function removeSection(doc: PanelDocument, sectionId: string): PanelDocument {
  return { ...doc, sections: reindexSections(doc.sections.filter((section) => section.id !== sectionId)) };
}

export function moveSection(doc: PanelDocument, sectionId: string, direction: -1 | 1): PanelDocument {
  const index = doc.sections.findIndex((section) => section.id === sectionId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= doc.sections.length) return doc;
  const sections = [...doc.sections];
  const [moved] = sections.splice(index, 1);
  sections.splice(target, 0, moved!);
  return { ...doc, sections: reindexSections(sections) };
}

export function duplicateSection(doc: PanelDocument, sectionId: string): { doc: PanelDocument; sectionId: string } | null {
  const index = doc.sections.findIndex((section) => section.id === sectionId);
  const source = doc.sections[index];
  if (!source || doc.sections.length >= MAX_SECTIONS) return null;
  const copy: Section = {
    ...source,
    id: makeId(),
    components: source.components.map((component) => cloneComponent(component)),
  };
  const sections = [...doc.sections];
  sections.splice(index + 1, 0, copy);
  return { doc: { ...doc, sections: reindexSections(sections) }, sectionId: copy.id };
}

export function setSectionLayout(doc: PanelDocument, sectionId: string, patch: Partial<Section['layout']>): PanelDocument {
  return mapSection(doc, sectionId, (section) => ({ ...section, layout: { ...section.layout, ...patch } }));
}

export function setSectionName(doc: PanelDocument, sectionId: string, locale: string, name: string): PanelDocument {
  return mapSection(doc, sectionId, (section) => {
    const next = { ...(section.name ?? {}) };
    // CORECROW rejects empty localized strings, so clearing a name removes the entry instead of storing "".
    if (name.trim()) next[locale] = name; else delete next[locale];
    const { name: _previous, ...rest } = section;
    return Object.keys(next).length ? { ...rest, name: next } : rest;
  });
}

function positions(section: Section, device: Device): GridItem[] {
  return section.components.map((component) => ({ id: component.id, ...component.layout[device] }));
}

export interface NewComponentInput { type: string; props: Record<string, unknown>; bindings?: Component['bindings'] }

/** Add at the bottom of a section (or of the first/new one) at the registry's default size for every breakpoint. */
export function addComponent(doc: PanelDocument, sectionId: string | null, input: NewComponentInput): { doc: PanelDocument; sectionId: string; componentId: string } | null {
  let working = doc;
  let targetId = sectionId ?? doc.sections[0]?.id ?? null;
  if (!targetId) {
    const created = addSection(doc);
    if (!created) return null;
    working = created.doc;
    targetId = created.sectionId;
  }
  const section = working.sections.find((item) => item.id === targetId);
  if (!section || section.components.length >= MAX_COMPONENTS_PER_SECTION) return null;
  const sizes = defaultSizes(input.type);
  const layout = Object.fromEntries(DEVICES.map((device) => [device, appendCell(positions(section, device), sizes[device].w, sizes[device].h)])) as ResponsiveLayout;
  const component: Component = {
    id: makeId(), type: input.type as Component['type'], schemaVersion: 1,
    props: input.props, bindings: input.bindings ?? {}, layout, order: section.components.length,
  };
  const next = mapSection(working, targetId, (current) => normalizeOrder({ ...current, components: [...current.components, component] }));
  return { doc: next, sectionId: targetId, componentId: component.id };
}

function cloneComponent(component: Component): Component {
  const props = JSON.parse(JSON.stringify(component.props)) as Record<string, unknown>;
  // List items carry their own ids; give the copy fresh ones so the two components never share identifiers.
  if (Array.isArray(props.items)) props.items = (props.items as Array<Record<string, unknown>>).map((item) => ({ ...item, id: makeId() }));
  return { ...component, id: makeId(), props, bindings: JSON.parse(JSON.stringify(component.bindings)) as Component['bindings'], layout: JSON.parse(JSON.stringify(component.layout)) as ResponsiveLayout };
}

export function duplicateComponent(doc: PanelDocument, componentId: string): { doc: PanelDocument; componentId: string } | null {
  const found = findComponent(doc, componentId);
  if (!found || found.section.components.length >= MAX_COMPONENTS_PER_SECTION) return null;
  const copy = cloneComponent(found.component);
  // The copy sits directly below the original on every breakpoint; the pass below pushes anything it collides with.
  for (const device of DEVICES) {
    const cell = found.component.layout[device];
    copy.layout[device] = { ...cell, y: cell.y + cell.h };
  }
  let section: Section = { ...found.section, components: [...found.section.components, copy] };
  for (const device of DEVICES) {
    const placed = placeItem(positions(section, device), copy.id, copy.layout[device]);
    section = { ...section, components: section.components.map((component) => {
      const cell = placed.find((item) => item.id === component.id);
      return cell ? { ...component, layout: { ...component.layout, [device]: { x: cell.x, y: cell.y, w: cell.w, h: cell.h } } } : component;
    }) };
  }
  return { doc: mapSection(doc, found.section.id, () => normalizeOrder(section)), componentId: copy.id };
}

export function removeComponent(doc: PanelDocument, componentId: string): PanelDocument {
  const found = findComponent(doc, componentId);
  if (!found) return doc;
  return mapSection(doc, found.section.id, (section) => normalizeOrder({ ...section, components: section.components.filter((component) => component.id !== componentId) }));
}

/** Set one component's cell on one breakpoint, pushing colliding siblings down on that breakpoint only. */
export function setComponentCell(doc: PanelDocument, componentId: string, device: Device, cell: Cell): PanelDocument {
  const found = findComponent(doc, componentId);
  if (!found) return doc;
  const placed = placeItem(positions(found.section, device), componentId, cell);
  return mapSection(doc, found.section.id, (section) => normalizeOrder({
    ...section,
    components: section.components.map((component) => {
      const next = placed.find((item) => item.id === component.id);
      if (!next) return component;
      const current = component.layout[device];
      if (current.x === next.x && current.y === next.y && current.w === next.w && current.h === next.h) return component;
      return { ...component, layout: { ...component.layout, [device]: { x: next.x, y: next.y, w: next.w, h: next.h } } };
    }),
  }));
}

export function setComponentProps(doc: PanelDocument, componentId: string, patch: Record<string, unknown>): PanelDocument {
  const found = findComponent(doc, componentId);
  if (!found) return doc;
  return mapSection(doc, found.section.id, (section) => ({
    ...section,
    components: section.components.map((component) => {
      if (component.id !== componentId) return component;
      const props = { ...component.props };
      for (const [key, value] of Object.entries(patch)) { if (value === undefined) delete props[key]; else props[key] = value; }
      return { ...component, props };
    }),
  }));
}

export function setComponentBinding(doc: PanelDocument, componentId: string, key: string, reference: Component['bindings'][string] | null): PanelDocument {
  const found = findComponent(doc, componentId);
  if (!found) return doc;
  return mapSection(doc, found.section.id, (section) => ({
    ...section,
    components: section.components.map((component) => {
      if (component.id !== componentId) return component;
      const bindings = { ...component.bindings };
      if (reference === null) delete bindings[key]; else bindings[key] = reference;
      return { ...component, bindings };
    }),
  }));
}

export type StructureIssueCode = 'DUPLICATE_ID' | 'TOO_MANY_SECTIONS' | 'TOO_MANY_COMPONENTS' | 'GEOMETRY';
export interface StructureIssue { code: StructureIssueCode; sectionId?: string; componentId?: string }

/** Local structural checks run before save/publish; CORECROW remains the authority and re-validates everything. */
export function validateStructure(doc: PanelDocument): StructureIssue[] {
  const issues: StructureIssue[] = [];
  const seen = new Set<string>();
  if (doc.sections.length > MAX_SECTIONS) issues.push({ code: 'TOO_MANY_SECTIONS' });
  for (const section of doc.sections) {
    if (seen.has(section.id)) issues.push({ code: 'DUPLICATE_ID', sectionId: section.id });
    seen.add(section.id);
    if (section.components.length > MAX_COMPONENTS_PER_SECTION) issues.push({ code: 'TOO_MANY_COMPONENTS', sectionId: section.id });
    for (const component of section.components) {
      if (seen.has(component.id)) issues.push({ code: 'DUPLICATE_ID', sectionId: section.id, componentId: component.id });
      seen.add(component.id);
      for (const device of DEVICES) {
        const { x, y, w, h } = component.layout[device];
        if (![x, y, w, h].every(Number.isInteger) || x < 0 || w < 1 || x + w > 12 || y < 0 || h < 1 || h > 100)
          issues.push({ code: 'GEOMETRY', sectionId: section.id, componentId: component.id });
      }
    }
  }
  return issues;
}
