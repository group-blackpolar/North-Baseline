import type { PanelDocument } from '@/lib/northAdmin';

export interface DocumentDiff {
  /** Components that exist only in the server version (someone else added them). */
  addedByOthers: string[];
  /** Components that exist only in your version (you added them, or someone else removed them). */
  onlyMine: string[];
  /** Same component, different content in the two versions. */
  changed: string[];
  sectionsMine: number;
  sectionsTheirs: number;
}

function components(doc: PanelDocument) {
  const map = new Map<string, string>();
  for (const section of doc.sections) for (const component of section.components) map.set(component.id, JSON.stringify(component));
  return map;
}

/** Summary of how your unsaved document differs from the version the server holds now. Compares by component id. */
export function diffDocuments(mine: PanelDocument, theirs: PanelDocument): DocumentDiff {
  const a = components(mine);
  const b = components(theirs);
  return {
    addedByOthers: [...b.keys()].filter((id) => !a.has(id)).sort(),
    onlyMine: [...a.keys()].filter((id) => !b.has(id)).sort(),
    changed: [...a.keys()].filter((id) => b.has(id) && a.get(id) !== b.get(id)).sort(),
    sectionsMine: mine.sections.length,
    sectionsTheirs: theirs.sections.length,
  };
}

export const hasDifferences = (diff: DocumentDiff) =>
  diff.addedByOthers.length + diff.onlyMine.length + diff.changed.length > 0 || diff.sectionsMine !== diff.sectionsTheirs;
