import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { activeCount, chipsOf, filterModeOf, filtersForDefinitions, removeChip, selectionToFilters, toggleValue } from './filterModel.ts';

type Def = Parameters<typeof filterModeOf>[0];
const consignee: Def = { fieldId: 'f1', type: 'TEXT', operators: ['EQ', 'IN', 'CONTAINS'] };
const legacy: Def = { fieldId: 'f1', type: 'TEXT', operators: ['EQ'] };
const arrival: Def = { fieldId: 'f2', type: 'DATE', operators: ['GTE', 'LTE'] };

test('control mode follows type and allowed operators', () => {
  assert.equal(filterModeOf(consignee), 'multi');
  assert.equal(filterModeOf(legacy), 'single');
  assert.equal(filterModeOf(arrival), 'range');
  assert.equal(filterModeOf({ fieldId: 'x', type: 'TEXT', operators: ['CONTAINS'] }), 'text');
  assert.equal(filterModeOf({ fieldId: 'x', type: 'TEXT', operators: ['GT', 'LT'] }), 'range');
  assert.equal(filterModeOf({ fieldId: 'x', type: 'TEXT', operators: ['NE'] }), 'none');
});

test('selections become only allowed operators', () => {
  assert.deepEqual(selectionToFilters(consignee, { values: ['A', 'B'] }), [{ fieldId: 'f1', operator: 'IN', value: ['A', 'B'] }]);
  assert.deepEqual(selectionToFilters(consignee, { values: ['A'] }), [{ fieldId: 'f1', operator: 'EQ', value: 'A' }]);
  assert.deepEqual(selectionToFilters(legacy, { values: ['A', 'B'] }), [{ fieldId: 'f1', operator: 'EQ', value: 'A' }]);
  assert.deepEqual(selectionToFilters(arrival, { from: '2026-01-01', to: '2026-01-31' }), [{ fieldId: 'f2', operator: 'GTE', value: '2026-01-01' }, { fieldId: 'f2', operator: 'LTE', value: '2026-01-31' }]);
  assert.deepEqual(selectionToFilters({ fieldId: 'd', type: 'DATETIME', operators: ['GTE', 'LTE'] }, { to: '2026-01-31' }), [{ fieldId: 'd', operator: 'LTE', value: '2026-01-31T23:59:59.999Z' }]);
  assert.deepEqual(selectionToFilters(consignee, { values: [], text: '  ' }), []);
});

test('a binding only receives filters for fields it defines, never more than ten', () => {
  const selections = { f1: { values: ['A'] }, f2: { from: '2026-01-01' }, other: { values: ['x'] } };
  assert.equal(filtersForDefinitions([consignee], selections).length, 1);
  assert.equal(filtersForDefinitions([consignee, arrival], selections, 'f1').length, 1);
  const many: Def[] = Array.from({ length: 12 }, (_, i) => ({ fieldId: `k${i}`, type: 'TEXT', operators: ['EQ'] }));
  assert.equal(filtersForDefinitions(many, Object.fromEntries(many.map((d) => [d.fieldId, { values: ['v'] }]))).length, 10);
});

test('toggle, chips and removal keep selections consistent', () => {
  let selections = { f1: toggleValue(undefined, 'A', true) };
  selections = { f1: toggleValue(selections.f1, 'B', true) };
  assert.deepEqual(selections.f1.values, ['A', 'B']);
  assert.deepEqual(toggleValue({ values: ['A'] }, 'B', false).values, ['B']);
  const chips = chipsOf([{ ...consignee, label: 'Consignee' }], selections);
  assert.deepEqual(chips.map((c) => c.text), ['Consignee: A', 'Consignee: B']);
  const afterOne = removeChip(selections, chips[0]!);
  assert.deepEqual(afterOne.f1?.values, ['B']);
  assert.equal(activeCount(removeChip(afterOne, chips[1]!)), 0);
});
