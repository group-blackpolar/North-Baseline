// Structural summary of the difference between two panel documents (Published vs Draft, or any two revisions).
// It is a *summary*, not a visual diff: which sections/components were added, removed, moved/resized or reconfigured.
// Framework-free and unit-tested with `node --test`.

import type { PanelDocument } from '@/lib/northAdmin';

export type ChangeKind = 'added' | 'removed' | 'moved' | 'configured' | 'rebound';
export interface ComponentChange { kind: ChangeKind; componentId: string; type: string }
export interface DocumentDiff {
  sectionsAdded: number;
  sectionsRemoved: number;
  sectionsReordered: number;
  components: ComponentChange[];
  identical: boolean;
}

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function indexComponents(doc: PanelDocument | null | undefined) {
  const map = new Map<string, { sectionId: string; component: PanelDocument['sections'][number]['components'][number] }>();
  for (const section of doc?.sections ?? []) for (const component of section.components) map.set(component.id, { sectionId: section.id, component });
  return map;
}

export function diffDocuments(before: PanelDocument | null | undefined, after: PanelDocument | null | undefined): DocumentDiff {
  const beforeSections = (before?.sections ?? []).map((section) => section.id);
  const afterSections = (after?.sections ?? []).map((section) => section.id);
  const sectionsAdded = afterSections.filter((id) => !beforeSections.includes(id)).length;
  const sectionsRemoved = beforeSections.filter((id) => !afterSections.includes(id)).length;
  const common = afterSections.filter((id) => beforeSections.includes(id));
  const sectionsReordered = same(common, beforeSections.filter((id) => afterSections.includes(id))) ? 0 : common.length;

  const was = indexComponents(before);
  const now = indexComponents(after);
  const components: ComponentChange[] = [];
  for (const [id, entry] of now) {
    const previous = was.get(id);
    if (!previous) { components.push({ kind: 'added', componentId: id, type: entry.component.type }); continue; }
    if (!same(previous.component.props, entry.component.props)) components.push({ kind: 'configured', componentId: id, type: entry.component.type });
    if (!same(previous.component.bindings, entry.component.bindings)) components.push({ kind: 'rebound', componentId: id, type: entry.component.type });
    if (previous.sectionId !== entry.sectionId || !same(previous.component.layout, entry.component.layout)) components.push({ kind: 'moved', componentId: id, type: entry.component.type });
  }
  for (const [id, entry] of was) if (!now.has(id)) components.push({ kind: 'removed', componentId: id, type: entry.component.type });

  const gapChanged = (after?.sections ?? []).some((section) => {
    const previous = (before?.sections ?? []).find((item) => item.id === section.id);
    return previous && !same(previous.layout, section.layout);
  });
  return { sectionsAdded, sectionsRemoved, sectionsReordered, components, identical: !gapChanged && sectionsAdded + sectionsRemoved + sectionsReordered === 0 && components.length === 0 };
}

export const countKind = (diff: DocumentDiff, kind: ChangeKind): number => diff.components.filter((change) => change.kind === kind).length;
