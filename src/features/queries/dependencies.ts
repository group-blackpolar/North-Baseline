// Dependency model for Queries -> Views. The only authoritative link CORECROW stores between a view and data is the
// component `bindings` entry (`sourceType: 'dataset'` + the owning `datasetId`). Everything here is derived from those
// real documents; nothing is inferred. Framework-free, unit-tested with `node --test`.

export interface DocumentLike { sections?: Array<{ id?: string; components?: Array<{ id?: string; type?: string; bindings?: Record<string, unknown> }> }> }
export interface DatasetRef { datasetId: string; bindingId: string; componentId: string; componentType: string }

export function extractDatasetRefs(document: DocumentLike | null | undefined): DatasetRef[] {
  const refs: DatasetRef[] = [];
  for (const section of document?.sections ?? []) {
    for (const component of section.components ?? []) {
      for (const binding of Object.values(component.bindings ?? {})) {
        const value = binding as { sourceType?: unknown; sourceId?: unknown; datasetId?: unknown } | null;
        if (value && value.sourceType === 'dataset' && typeof value.datasetId === 'string' && value.datasetId) {
          refs.push({ datasetId: value.datasetId, bindingId: typeof value.sourceId === 'string' ? value.sourceId : '', componentId: component.id ?? '', componentType: component.type ?? '' });
        }
      }
    }
  }
  return refs;
}

export interface PanelInfo { id: string; name: Record<string, string>; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'; categoryName: Record<string, string> }
export interface DatasetInfo { id: string; name: Record<string, string>; status: 'ACTIVE' | 'ARCHIVED' }

export interface DependencyReport {
  /** dataset id -> the views (and components) that read it */
  byDataset: Map<string, Array<{ panel: PanelInfo; refs: DatasetRef[] }>>;
  /** References to datasets that no longer exist in this organization, or are archived. */
  broken: Array<{ panel: PanelInfo; ref: DatasetRef; reason: 'MISSING' | 'ARCHIVED' }>;
  /** Active datasets that no scanned view reads. */
  unused: DatasetInfo[];
  /** Archived views that still reference a dataset (their binding keeps a dataset "in use"). */
  archivedViewsWithRefs: PanelInfo[];
}

export function buildDependencyReport(panels: PanelInfo[], refsByPanel: Map<string, DatasetRef[]>, datasets: DatasetInfo[]): DependencyReport {
  const known = new Map(datasets.map((dataset) => [dataset.id, dataset]));
  const byDataset: DependencyReport['byDataset'] = new Map();
  const broken: DependencyReport['broken'] = [];
  const archivedViewsWithRefs: PanelInfo[] = [];
  for (const panel of panels) {
    const refs = refsByPanel.get(panel.id) ?? [];
    if (refs.length === 0) continue;
    if (panel.status === 'ARCHIVED') archivedViewsWithRefs.push(panel);
    const grouped = new Map<string, DatasetRef[]>();
    for (const ref of refs) (grouped.get(ref.datasetId) ?? grouped.set(ref.datasetId, []).get(ref.datasetId)!).push(ref);
    for (const [datasetId, list] of grouped) {
      (byDataset.get(datasetId) ?? byDataset.set(datasetId, []).get(datasetId)!).push({ panel, refs: list });
      // An archived view is not live, so it cannot be "broken"; it is listed separately.
      if (panel.status === 'ARCHIVED') continue;
      const dataset = known.get(datasetId);
      if (!dataset) broken.push({ panel, ref: list[0]!, reason: 'MISSING' });
      else if (dataset.status === 'ARCHIVED') broken.push({ panel, ref: list[0]!, reason: 'ARCHIVED' });
    }
  }
  const unused = datasets.filter((dataset) => dataset.status === 'ACTIVE' && !(byDataset.get(dataset.id)?.some((entry) => entry.panel.status !== 'ARCHIVED')));
  return { byDataset, broken, unused, archivedViewsWithRefs };
}
