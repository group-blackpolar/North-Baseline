import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { buildDependencyReport, extractDatasetRefs, type DatasetInfo, type PanelInfo } from './dependencies.ts';

const doc = {
  sections: [{ components: [
    { id: 'k1', type: 'metric', bindings: { value: { sourceType: 'dataset', sourceId: 'b1', datasetId: 'd1' } } },
    { id: 'k2', type: 'bar_chart', bindings: { data: { sourceType: 'dataset', sourceId: 'b2', datasetId: 'd2' }, extra: { sourceType: 'metric', sourceId: 'x' } } },
    { id: 'h', type: 'heading' },
  ] }],
};

test('extracts only authoritative dataset bindings', () => {
  const refs = extractDatasetRefs(doc);
  assert.deepEqual(refs.map((r) => [r.datasetId, r.componentId, r.componentType]), [['d1', 'k1', 'metric'], ['d2', 'k2', 'bar_chart']]);
  assert.deepEqual(extractDatasetRefs(null), []);
  assert.deepEqual(extractDatasetRefs({ sections: [{ components: [{ bindings: { a: { sourceType: 'dataset', datasetId: 5 } } }] }] }), []);
});

test('reports which views use which dataset, broken references and unused datasets', () => {
  const name = (value: string) => ({ es: value });
  const panels: PanelInfo[] = [
    { id: 'p1', name: name('Ventas'), status: 'PUBLISHED', categoryName: name('Ops') },
    { id: 'p2', name: name('Viejo'), status: 'ARCHIVED', categoryName: name('Ops') },
    { id: 'p3', name: name('Sin datos'), status: 'DRAFT', categoryName: name('Ops') },
  ];
  const datasets: DatasetInfo[] = [{ id: 'd1', name: name('A'), status: 'ACTIVE' }, { id: 'd3', name: name('C'), status: 'ACTIVE' }, { id: 'd2', name: name('B'), status: 'ARCHIVED' }];
  const refs = new Map([['p1', extractDatasetRefs(doc)], ['p2', extractDatasetRefs({ sections: [{ components: [{ id: 'z', type: 'metric', bindings: { v: { sourceType: 'dataset', sourceId: 'b', datasetId: 'd9' } } }] }] })]]);
  const report = buildDependencyReport(panels, refs, datasets);
  assert.deepEqual(report.byDataset.get('d1')!.map((e) => e.panel.id), ['p1']);
  assert.deepEqual(report.broken.map((b) => [b.panel.id, b.ref.datasetId, b.reason]), [['p1', 'd2', 'ARCHIVED']], 'archived views are not reported as broken');
  assert.deepEqual(report.unused.map((d) => d.id), ['d3']);
  assert.deepEqual(report.archivedViewsWithRefs.map((p) => p.id), ['p2']);
});
