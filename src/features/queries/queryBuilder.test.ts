import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { aliasFrom, buildQuery, chartableShape, columnStats, emptyBuilder, measuresFor, operatorsFor, type BuilderState, type QueryField } from './queryBuilder.ts';

const fields: QueryField[] = [
  { id: 'f-name', key: 'name', label: 'Nombre', type: 'TEXT' },
  { id: 'f-qty', key: 'qty', label: 'Cantidad', type: 'INTEGER' },
  { id: 'f-day', key: 'day', label: 'Fecha', type: 'DATE' },
  { id: 'f-ok', key: 'ok', label: 'Activo', type: 'BOOLEAN' },
];
const rows = (patch: Partial<BuilderState>): BuilderState => ({ ...emptyBuilder(), fields: ['f-name', 'f-qty'], ...patch });

test('operators and measures respect field types', () => {
  assert.ok(!operatorsFor('TEXT').includes('GT'));
  assert.ok(operatorsFor('DATE').includes('BETWEEN'));
  assert.ok(!operatorsFor('BOOLEAN').includes('CONTAINS'));
  assert.deepEqual(measuresFor('TEXT'), ['COUNT', 'COUNT_DISTINCT']);
  assert.ok(measuresFor('INTEGER').includes('SUM'));
  assert.ok(!measuresFor('DATE').includes('SUM'));
});

test('builds a ROWS request: between becomes GTE+LTE, null checks become EQ/NE null', () => {
  const result = buildQuery(rows({
    filters: [
      { id: '1', fieldId: 'f-qty', operator: 'BETWEEN', value: '5', value2: '10' },
      { id: '2', fieldId: 'f-name', operator: 'IS_NOT_NULL', value: '', value2: '' },
      { id: '3', fieldId: 'f-ok', operator: 'EQ', value: 'true', value2: '' },
    ],
    orderBy: [{ key: 'f-qty', direction: 'DESC' }], limit: 500,
  }), fields);
  assert.ok(result.ok);
  if (!result.ok || result.request.mode !== 'ROWS') return;
  assert.deepEqual(result.request.filters, [
    { fieldId: 'f-qty', operator: 'GTE', value: 5 }, { fieldId: 'f-qty', operator: 'LTE', value: 10 },
    { fieldId: 'f-name', operator: 'NE', value: null }, { fieldId: 'f-ok', operator: 'EQ', value: true },
  ]);
  assert.equal(result.request.limit, 200, 'limit is clamped to the contract maximum');
});

test('rejects what the contract would reject, with codes', () => {
  const bad = (state: BuilderState) => { const r = buildQuery(state, fields); return r.ok ? [] : r.errors; };
  assert.deepEqual(bad(rows({ fields: [] })), ['NO_FIELDS']);
  assert.deepEqual(bad(rows({ filters: [{ id: '1', fieldId: 'f-name', operator: 'GT', value: 'a', value2: '' }] })), ['FILTER_OPERATOR']);
  assert.deepEqual(bad(rows({ filters: [{ id: '1', fieldId: 'f-qty', operator: 'EQ', value: '1.5', value2: '' }] })), ['FILTER_VALUE']);
  assert.deepEqual(bad(rows({ fields: ['f-name', 'f-name'] })), ['DUPLICATE_FIELDS']);
  assert.ok(bad(rows({ filters: Array.from({ length: 11 }, (_, i) => ({ id: String(i), fieldId: 'f-name', operator: 'IS_NULL' as const, value: '', value2: '' })) })).includes('TOO_MANY_FILTERS'));
});

test('aggregate: grouping, measures, ordering by outputs only', () => {
  const state: BuilderState = {
    ...emptyBuilder(), mode: 'AGGREGATE', groupBy: ['f-name'], measures: [{ id: 'm', operation: 'SUM', fieldId: 'f-qty', alias: 'total' }, { id: 'n', operation: 'COUNT', fieldId: '', alias: 'rows' }],
    orderBy: [{ key: 'total', direction: 'DESC' }], limit: 10,
  };
  const ok = buildQuery(state, fields);
  assert.ok(ok.ok);
  if (ok.ok && ok.request.mode === 'AGGREGATE') assert.deepEqual(ok.request.measures, [{ operation: 'SUM', fieldId: 'f-qty', alias: 'total' }, { operation: 'COUNT', alias: 'rows' }]);
  const badOrder = buildQuery({ ...state, orderBy: [{ key: 'f-qty', direction: 'ASC' }] }, fields);
  assert.ok(!badOrder.ok && badOrder.errors.includes('ORDER_OUTPUT'));
  const badMeasure = buildQuery({ ...state, measures: [{ id: 'm', operation: 'SUM', fieldId: 'f-name', alias: 'x' }] }, fields);
  assert.ok(!badMeasure.ok && badMeasure.errors.includes('MEASURE_TYPE'));
  const badAlias = buildQuery({ ...state, measures: [{ id: 'm', operation: 'COUNT', fieldId: '', alias: 'Bad Alias' }] }, fields);
  assert.ok(!badAlias.ok && badAlias.errors.includes('MEASURE_ALIAS'));
});

test('stats describe only the returned rows; charts need a label and a number', () => {
  const columns = [{ key: 'name', type: 'TEXT' as const }, { key: 'qty', type: 'INTEGER' as const }];
  const data = [{ name: 'a', qty: 2 }, { name: 'b', qty: 4 }, { name: 'b', qty: null }];
  const [name, qty] = columnStats(columns, data);
  assert.deepEqual({ count: name!.count, distinct: name!.distinct }, { count: 3, distinct: 2 });
  assert.deepEqual({ count: qty!.count, nulls: qty!.nulls, mean: qty!.mean, max: qty!.max }, { count: 2, nulls: 1, mean: 3, max: 4 });
  assert.ok(chartableShape(columns, data));
  assert.equal(chartableShape([{ key: 'qty', type: 'INTEGER' }], data), null);
  assert.equal(chartableShape(columns, [data[0]]), null);
});

test('aliases are valid and unique', () => {
  assert.equal(aliasFrom('Ventas Totales', []), 'ventas_totales');
  assert.equal(aliasFrom('Ventas Totales', ['ventas_totales']), 'ventas_totales_2');
  assert.match(aliasFrom('123', []), /^[a-z][a-z0-9_]*$/);
});
