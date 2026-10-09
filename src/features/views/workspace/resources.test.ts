import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  activeFilterCount, applyFilters, detectHealth, emptyFilters, filtersToParams, flattenTree, groupResources, paginate, paramsToFilters, queryResources, summarize,
  type TreeCategory,
} from './resources.ts';

const tree: TreeCategory[] = [
  {
    id: 'c1', name: { es: 'Operaciones', en: 'Operations' }, slug: 'ops', status: 'ACTIVE', resourceKind: 'CONTENT', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-02-01T00:00:00Z',
    subcategories: [
      {
        id: 's1', categoryId: 'c1', name: { es: 'Tableros' }, slug: 'boards', status: 'ACTIVE', resourceKind: 'CONTENT', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-02-02T00:00:00Z',
        panels: [
          { id: 'p1', subcategoryId: 's1', name: { es: 'Ventas mensuales' }, slug: 'ventas', status: 'PUBLISHED', resourceKind: 'CONTENT', audienceType: 'ALL_MEMBERS', createdAt: '2026-01-03T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z', publishedRevisionId: 'r1', draftRevisionId: 'r2' },
          { id: 'p2', subcategoryId: 's1', name: { es: 'Inventario' }, description: { es: 'Existencias por almacén' }, slug: 'inv', status: 'DRAFT', resourceKind: 'CONTENT', audienceType: 'ROLES', createdAt: '2026-01-04T00:00:00Z', updatedAt: '2026-03-12T00:00:00Z', publishedRevisionId: null, draftRevisionId: 'r3' },
          { id: 'p3', subcategoryId: 's1', name: { es: 'Viejo' }, slug: 'old', status: 'ARCHIVED', resourceKind: 'CONTENT', audienceType: 'ALL_MEMBERS', createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-06-01T00:00:00Z', publishedRevisionId: 'r0', draftRevisionId: 'r0' },
        ],
      },
      { id: 's2', categoryId: 'c1', name: { es: 'Vacía' }, slug: 'empty', status: 'ACTIVE', resourceKind: 'CONTENT', panels: [] },
    ],
  },
  { id: 'c2', name: { es: 'Sistema' }, slug: 'admin', status: 'ACTIVE', resourceKind: 'SYSTEM', subcategories: [] },
];
const all = flattenTree(tree);

test('flattens categories, subcategories and views with real derived flags', () => {
  assert.equal(all.length, 7);
  assert.equal(all.find((r) => r.id === 'p1')!.hasUnpublishedChanges, true, 'published with a different draft');
  assert.equal(all.find((r) => r.id === 'p3')!.hasUnpublishedChanges, false);
  assert.equal(all.find((r) => r.id === 'c1')!.childCount, 2);
});

test('search is accent-insensitive, multi-word and covers description, slug, id and parents', () => {
  const q = (text: string) => applyFilters(all, { ...emptyFilters(), q: text }).map((r) => r.id);
  assert.deepEqual(q('almacen'), ['p2']);
  assert.deepEqual(q('ventas mensuales'), ['p1']);
  assert.ok(q('operations').includes('p1'), 'matches the parent category name in another locale');
  assert.deepEqual(q('p3'), ['p3']);
});

test('filters are OR within a group and AND across groups', () => {
  const run = (patch: object) => applyFilters(all, { ...emptyFilters(), ...patch }).map((r) => r.id).sort();
  assert.deepEqual(run({ kinds: ['PANEL'], statuses: ['DRAFT', 'ARCHIVED'] }), ['p2', 'p3']);
  assert.deepEqual(run({ kinds: ['PANEL'], statuses: ['DRAFT'], audiences: ['ALL_MEMBERS'] }), []);
  assert.deepEqual(run({ unpublishedOnly: true }), ['p1']);
  assert.deepEqual(run({ origin: 'system' }), ['c2']);
});

test('date ranges are inclusive and ignore resources without the date', () => {
  const run = (patch: object) => applyFilters(all, { ...emptyFilters(), kinds: ['PANEL'], ...patch }).map((r) => r.id).sort();
  assert.deepEqual(run({ updatedFrom: '2026-03-10', updatedTo: '2026-03-10' }), ['p1']);
  assert.deepEqual(run({ updatedFrom: '2026-03-11' }), ['p2']);
  assert.deepEqual(run({ createdTo: '2025-12-31' }), ['p3']);
});

test('sorting is stable and honours direction', () => {
  const names = (sort: 'name' | 'updatedAt', dir: 'asc' | 'desc') => queryResources(all.filter((r) => r.kind === 'PANEL'), { ...emptyFilters(), sort, dir }, 'es').matched.map((r) => r.id);
  assert.deepEqual(names('name', 'asc'), ['p2', 'p1', 'p3'].sort((a, b) => ['p2', 'p1', 'p3'].indexOf(a) - ['p2', 'p1', 'p3'].indexOf(b)));
  assert.deepEqual(names('updatedAt', 'desc'), ['p2', 'p1', 'p3']);
});

test('counts, grouping, pagination and summary come from the same collection', () => {
  assert.equal(activeFilterCount({ ...emptyFilters(), q: 'x', kinds: ['PANEL'], unpublishedOnly: true }), 3);
  assert.equal(activeFilterCount(emptyFilters()), 0);
  const groups = groupResources(all.filter((r) => r.kind === 'PANEL'), 'status', 'es');
  assert.deepEqual(groups.map((g) => g.key).sort(), ['ARCHIVED', 'DRAFT', 'PUBLISHED']);
  const page = paginate([1, 2, 3, 4, 5], 9, 2);
  assert.deepEqual({ page: page.page, pages: page.pages, items: page.items, from: page.from, to: page.to }, { page: 3, pages: 3, items: [5], from: 5, to: 5 });
  const s = summarize(all, Date.parse('2026-03-13T00:00:00Z'));
  assert.deepEqual({ views: s.views, published: s.published, drafts: s.drafts, archived: s.archived, recent: s.recentlyUpdated }, { views: 3, published: 1, drafts: 1, archived: 1, recent: 2 });
});

test('health only reports problems provable from the tree and skips system resources', () => {
  const codes = detectHealth(all).map((i) => `${i.code}:${i.resourceId}`).sort();
  assert.deepEqual(codes, ['EMPTY_SUBCATEGORY:s2', 'NEVER_PUBLISHED:p2', 'UNPUBLISHED_CHANGES:p1']);
});

test('filters round-trip through URL params and reject junk', () => {
  const filters = { ...emptyFilters(), q: 'ventas', kinds: ['PANEL'], statuses: ['DRAFT', 'PUBLISHED'], updatedFrom: '2026-01-01', unpublishedOnly: true, sort: 'name' as const, dir: 'asc' as const };
  const back = paramsToFilters(filtersToParams(filters));
  assert.deepEqual(back, filters);
  const junk = paramsToFilters(new URLSearchParams('vuf=not-a-date&vsort=__proto__&vo=hack'));
  assert.equal(junk.updatedFrom, '');
  assert.equal(junk.sort, 'updatedAt');
  assert.equal(junk.origin, 'all');
});
