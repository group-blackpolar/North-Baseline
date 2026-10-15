import assert from 'node:assert/strict';
import test from 'node:test';
import type { PanelDocument } from '@/lib/northAdmin';
import { diffDocuments, hasDifferences } from './conflict.ts';

const component = (id: string, label = id) => ({ id, type: 'heading', schemaVersion: 1, props: { label }, bindings: {}, order: 0, layout: { desktop: { x: 0, y: 0, w: 4, h: 2 }, tablet: { x: 0, y: 0, w: 4, h: 2 }, mobile: { x: 0, y: 0, w: 12, h: 2 } } });
const doc = (...components: ReturnType<typeof component>[]) => ({ schemaVersion: 1, defaultLocale: 'es', fallbackLocales: [], sections: [{ id: 's1', order: 0, layout: { variant: 'grid', gap: 'md' }, components }] }) as unknown as PanelDocument;

test('identical documents have no differences', () => {
  const same = diffDocuments(doc(component('a'), component('b')), doc(component('a'), component('b')));
  assert.equal(hasDifferences(same), false);
});

test('reports what others added, what only you have and what changed on both sides', () => {
  const mine = doc(component('a', 'mine'), component('b'), component('mineOnly'));
  const theirs = doc(component('a', 'theirs'), component('b'), component('theirOnly'));
  const diff = diffDocuments(mine, theirs);
  assert.deepEqual(diff.addedByOthers, ['theirOnly']);
  assert.deepEqual(diff.onlyMine, ['mineOnly']);
  assert.deepEqual(diff.changed, ['a']);
  assert.equal(hasDifferences(diff), true);
});

test('a different number of sections is a difference even with equal components', () => {
  const theirs = doc(component('a'));
  (theirs.sections as unknown[]).push({ id: 's2', order: 1, layout: { variant: 'grid', gap: 'md' }, components: [] });
  assert.equal(hasDifferences(diffDocuments(doc(component('a')), theirs)), true);
});
