import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { appendCell, clampCell, columnAt, growBy, nudge, overlaps, placeItem, resizeCell, rowAt } from './grid.ts';
import { COALESCE_MS, HISTORY_LIMIT, emptyHistory, record, redo, undo } from './history.ts';
import { addComponent, addSection, duplicateComponent, findComponent, removeComponent, removeSection, setComponentBinding, setComponentCell, setComponentProps, setSectionName, validateStructure } from './documentOps.ts';
import { diffDocuments } from './docDiff.ts';
import { bindingColumns, measureAlias, staleKeys, suggestProps, type BindingLike } from './bindingModel.ts';
import { acceptsBinding, addableDefinitions, defaultSizes, definitionOf } from './registry.ts';

const empty = () => ({ schemaVersion: 1 as const, defaultLocale: 'es', fallbackLocales: ['en'], sections: [] });

test('grid: clamp keeps the CORECROW contract', () => {
  assert.deepEqual(clampCell({ x: 10, y: -3, w: 9, h: 500 }), { x: 3, y: 0, w: 9, h: 100 });
  assert.deepEqual(clampCell({ x: 0, y: 0, w: 0, h: 0 }), { x: 0, y: 0, w: 1, h: 1 });
});

test('grid: placing pushes colliders down and never moves the placed item', () => {
  const items = [{ id: 'a', x: 0, y: 0, w: 6, h: 2 }, { id: 'b', x: 0, y: 2, w: 6, h: 2 }, { id: 'c', x: 6, y: 0, w: 6, h: 2 }];
  const result = placeItem(items, 'c', { x: 0, y: 0, w: 6, h: 2 });
  const byId = Object.fromEntries(result.map((item) => [item.id, item]));
  assert.equal(byId.c!.y, 0);
  assert.equal(byId.a!.y, 2);
  assert.equal(byId.b!.y, 4); // cascaded
  for (const left of result) for (const right of result) if (left.id < right.id) assert.equal(overlaps(left, right), false);
});

test('grid: resize handles respect edges', () => {
  const start = { x: 4, y: 1, w: 4, h: 2 };
  assert.deepEqual(resizeCell(start, 'e', 20, 0), { x: 4, y: 1, w: 8, h: 2 });
  assert.deepEqual(resizeCell(start, 'w', -2, 0), { x: 2, y: 1, w: 6, h: 2 });
  assert.deepEqual(resizeCell(start, 'w', 10, 0), { x: 7, y: 1, w: 1, h: 2 }); // right edge fixed, min width 1
  assert.deepEqual(resizeCell(start, 'se', 1, 3), { x: 4, y: 1, w: 5, h: 5 });
  assert.equal(growBy({ x: 10, y: 0, w: 2, h: 1 }, 3, 0).w, 2);
  assert.deepEqual(nudge({ x: 0, y: 0, w: 3, h: 1 }, -1, -1), { x: 0, y: 0, w: 3, h: 1 });
});

test('grid: pointer to cell conversion handles uneven rows and drops below content', () => {
  assert.equal(columnAt(0, 1200, 16), 0);
  assert.equal(columnAt(1199, 1200, 16), 11);
  assert.equal(rowAt(10, [32, 100], 16), 0);
  assert.equal(rowAt(60, [32, 100], 16), 1);
  assert.ok(rowAt(1000, [32, 100], 16) > 2);
  assert.deepEqual(appendCell([{ x: 0, y: 0, w: 12, h: 2 }], 6, 3), { x: 0, y: 2, w: 6, h: 3 });
  // Beside the last band when it fits, below when it does not.
  assert.deepEqual(appendCell([{ x: 0, y: 0, w: 3, h: 2 }], 6, 6), { x: 3, y: 0, w: 6, h: 6 });
  assert.deepEqual(appendCell([{ x: 0, y: 0, w: 3, h: 2 }, { x: 3, y: 0, w: 6, h: 6 }], 4, 6), { x: 0, y: 6, w: 4, h: 6 });
  assert.deepEqual(appendCell([], 4, 2), { x: 0, y: 0, w: 4, h: 2 });
});

test('history: undo/redo, coalescing and limit', () => {
  let history = emptyHistory<number>();
  history = record(history, 0, { key: 'k', now: 1000 });
  history = record(history, 1, { key: 'k', now: 1100 }); // merged
  assert.equal(history.past.length, 1);
  history = record(history, 2, { key: 'k', now: 1100 + COALESCE_MS + 1 });
  assert.equal(history.past.length, 2);
  const back = undo(history, 3)!;
  assert.equal(back.state, 2);
  const forward = redo(back.history, back.state)!;
  assert.equal(forward.state, 3);
  assert.equal(undo(emptyHistory<number>(), 0), null);
  let big = emptyHistory<number>();
  for (let index = 0; index < HISTORY_LIMIT + 20; index++) big = record(big, index);
  assert.equal(big.past.length, HISTORY_LIMIT);
  // A new edit after an undo discards the redo branch.
  assert.equal(record(back.history, 9).future.length, 0);
});

test('documentOps: add, duplicate, remove keep ids unique and geometry valid', () => {
  const first = addComponent(empty(), null, { type: 'metric', props: { label: { es: 'A', en: 'A' } } })!;
  assert.equal(first.doc.sections.length, 1);
  const second = addComponent(first.doc, first.sectionId, { type: 'bar_chart', props: {} })!;
  const chart = findComponent(second.doc, second.componentId)!.component;
  assert.deepEqual(chart.layout.desktop, { x: 3, y: 0, w: 6, h: 6 }); // beside the metric on desktop
  assert.deepEqual(chart.layout.mobile, { x: 0, y: 2, w: 12, h: 6 }); // stacked below it on mobile
  const copy = duplicateComponent(second.doc, second.componentId)!;
  assert.notEqual(copy.componentId, second.componentId);
  assert.deepEqual(validateStructure(copy.doc), []);
  const removed = removeComponent(copy.doc, second.componentId);
  assert.equal(findComponent(removed, second.componentId), null);
  assert.deepEqual(removed.sections[0]!.components.map((component) => component.order), [0, 1]);
});

test('documentOps: moving on one breakpoint leaves the others untouched', () => {
  const a = addComponent(empty(), null, { type: 'heading', props: {} })!;
  const b = addComponent(a.doc, a.sectionId, { type: 'card', props: {} })!;
  const moved = setComponentCell(b.doc, b.componentId, 'mobile', { x: 0, y: 0, w: 12, h: 2 });
  const heading = findComponent(moved, a.componentId)!.component;
  assert.ok(heading.layout.mobile.y >= 2); // pushed on mobile
  assert.equal(heading.layout.desktop.y, 0); // desktop unchanged
  assert.deepEqual(validateStructure(moved), []);
});

test('documentOps: props, bindings and section names', () => {
  const a = addComponent(empty(), null, { type: 'metric', props: { label: { es: 'x' }, value: '0' } })!;
  let doc = setComponentProps(a.doc, a.componentId, { value: undefined, fieldKey: 'total' });
  assert.equal('value' in findComponent(doc, a.componentId)!.component.props, false);
  doc = setComponentBinding(doc, a.componentId, 'data', { sourceType: 'dataset', sourceId: 'b1', datasetId: 'd1' });
  assert.equal(Object.keys(findComponent(doc, a.componentId)!.component.bindings).length, 1);
  doc = setComponentBinding(doc, a.componentId, 'data', null);
  assert.deepEqual(findComponent(doc, a.componentId)!.component.bindings, {});
  doc = setSectionName(doc, a.sectionId, 'es', 'KPIs');
  assert.equal(doc.sections[0]!.name?.es, 'KPIs');
  doc = setSectionName(doc, a.sectionId, 'es', '  ');
  assert.equal(doc.sections[0]!.name, undefined);
  const grown = addSection(doc)!;
  assert.equal(removeSection(grown.doc, grown.sectionId).sections.length, 1);
});

test('docDiff: summarises structural changes', () => {
  const a = addComponent(empty(), null, { type: 'heading', props: { text: { es: 'a' } } })!;
  assert.equal(diffDocuments(a.doc, a.doc).identical, true);
  const edited = setComponentProps(a.doc, a.componentId, { text: { es: 'b' } });
  const moved = setComponentCell(edited, a.componentId, 'desktop', { x: 2, y: 0, w: 6, h: 1 });
  const added = addComponent(moved, a.sectionId, { type: 'divider', props: {} })!;
  const diff = diffDocuments(a.doc, added.doc);
  const kinds = diff.components.map((change) => change.kind).sort();
  assert.deepEqual(kinds, ['added', 'configured', 'moved']);
  assert.equal(diffDocuments(added.doc, a.doc).components.some((change) => change.kind === 'removed'), true);
  assert.equal(diffDocuments(null, a.doc).components[0]!.kind, 'added');
});

test('bindingModel: columns come from the declared query and drive compatibility', () => {
  const fields = new Map([['f-country', { label: 'País', type: 'TEXT' as const }], ['f-amount', { label: 'Monto', type: 'DECIMAL' as const }]]);
  const aggregate: BindingLike = { id: 'b', datasetId: 'd', name: 'n', query: { mode: 'AGGREGATE', groupBy: ['f-country'], measures: [{ alias: 'total', operation: 'SUM', fieldId: 'f-amount' }] } };
  const columns = bindingColumns(aggregate, fields);
  assert.deepEqual(columns.map((column) => [column.key, column.role, column.numeric]), [['f-country', 'dimension', false], ['total', 'measure', true]]);
  const bar = suggestProps('bar_chart', columns);
  assert.equal(bar.compatibility, 'ok');
  assert.equal(bar.props.categoryKey, 'f-country');
  assert.equal(suggestProps('donut_chart', columns).props.valueKey, 'total');
  assert.equal(suggestProps('metric', columns).props.fieldKey, 'total');
  const rows: BindingLike = { id: 'b2', datasetId: 'd', name: 'n', query: { mode: 'ROWS', fields: ['f-country'] } };
  assert.equal(suggestProps('bar_chart', bindingColumns(rows, fields)).compatibility, 'NO_NUMERIC');
  assert.equal(suggestProps('metric', bindingColumns(rows, fields)).compatibility, 'NO_NUMERIC');
  assert.deepEqual(staleKeys('bar_chart', { categoryKey: 'f-country', series: [{ key: 'gone' }] }, columns), ['gone']);
});

test('registry: assets are not addable and charts require a binding', () => {
  assert.equal(addableDefinitions().some((definition) => ['image', 'video', 'file', 'document_workspace'].includes(definition.type)), false);
  assert.equal(definitionOf('bar_chart')?.binding, 'required');
  assert.equal(acceptsBinding('heading'), false);
  assert.equal(defaultSizes('metric').mobile.w, 12);
});

import { cellRect } from './grid.ts';
test('grid: cell rectangles account for gaps and uneven rows', () => {
  const metrics = { width: 1200, gap: 12, tracks: [32, 100, 32] };
  const rect = cellRect({ x: 6, y: 1, w: 6, h: 2 }, metrics);
  assert.equal(rect.top, 32 + 12);
  assert.equal(rect.height, 100 + 12 + 32);
  const col = (1200 - 12 * 11) / 12;
  assert.equal(Math.round(rect.left), Math.round(6 * (col + 12)));
  assert.equal(Math.round(rect.width), Math.round(6 * col + 5 * 12));
});

import { RECOVERY_TTL_MS, clearRecovery, readRecovery, recoveryKey, shouldOffer, writeRecovery } from './recovery.ts';
function memoryStore() { const map = new Map<string, string>(); return { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v); }, removeItem: (k: string) => { map.delete(k); } }; }
test('recovery: round-trips, expires, and is offered only for the same server draft', () => {
  const store = memoryStore();
  const key = recoveryKey('o', 'p');
  assert.equal(readRecovery(store, key), null);
  assert.equal(writeRecovery(store, key, { baseEtag: 'e1', savedAt: 1000, document: { a: 1 } }), true);
  const entry = readRecovery<{ a: number }>(store, key, 2000)!;
  assert.equal(shouldOffer(entry, 'e1', { a: 2 }), true);
  assert.equal(shouldOffer(entry, 'e1', { a: 1 }), false); // identical to the server draft: nothing to recover
  assert.equal(shouldOffer(entry, 'e2', { a: 2 }), false); // server moved on: never offer a stale overwrite
  assert.equal(readRecovery(store, key, 1000 + RECOVERY_TTL_MS + 1), null);
  assert.equal(store.getItem(key), null); // expired entries are removed
  writeRecovery(store, key, { baseEtag: 'e', savedAt: 1, document: 1 });
  clearRecovery(store, key);
  assert.equal(readRecovery(store, key), null);
  assert.equal(writeRecovery(null, key, { baseEtag: 'e', savedAt: 1, document: 1 }), false);
  assert.equal(writeRecovery(store, key, { baseEtag: 'e', savedAt: 1, document: 'x'.repeat(2_000_000) }), false);
});

test('bindingModel: measure aliases satisfy the CORECROW alias pattern', () => {
  const ok = /^[a-z][a-z0-9_]{0,63}$/;
  for (const [op, label] of [['SUM', 'Monto total'], ['AVG', 'Ñandú (kg)'], ['MAX', '123'], ['MIN', '***'], ['SUM', 'x'.repeat(200)]] as const) assert.match(measureAlias(op, label), ok);
  assert.equal(measureAlias('COUNT', undefined), 'total');
  assert.equal(measureAlias('SUM', 'Monto'), 'sum_monto');
});

import { VIEW_TEMPLATES, createDocumentFromTemplate } from '../viewTemplates.ts';
test('templates: generic, schema-shaped, and free of sample data', () => {
  for (const id of VIEW_TEMPLATES) {
    const doc = createDocumentFromTemplate(id, 'Mi vista');
    assert.ok(doc.sections.length >= 1, id);
    assert.deepEqual(validateStructure(doc), [], id);
    const all = doc.sections.flatMap((section) => section.components);
    for (const component of all) {
      assert.equal(Object.keys(component.bindings).length, 0, 'templates never carry bindings'); // the admin connects their own data
      if (component.type === 'metric') {
        assert.equal(component.props.value, undefined, 'no invented KPI values');
        assert.ok(['number', 'currency', 'percent', 'duration', 'text'].includes(String(component.props.format)), 'format must be a CORECROW enum value');
      }
      if (component.type === 'table') assert.deepEqual(component.props.rows, []);
    }
    // Two independent copies share no identifiers.
    const again = createDocumentFromTemplate(id, 'Mi vista').sections.flatMap((section) => section.components);
    assert.equal(all.some((component) => again.some((other) => other.id === component.id)), false);
  }
  assert.equal(createDocumentFromTemplate('blank', 'Mi vista').sections[0]!.components[0]!.props.text instanceof Object, true);
});
