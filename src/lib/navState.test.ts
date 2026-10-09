import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import type { FlowStorage } from './authFlow.ts';
import { clearNavState, loadNavState, navKey, parseNavSnapshot, saveNavState } from './navState.ts';

const fake = () => {
  const data = new Map<string, string>();
  const storage: FlowStorage & { length: number; key(i: number): string | null } = {
    get length() { return data.size; },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null, setItem: (k, v) => { data.set(k, v); }, removeItem: (k) => { data.delete(k); },
  };
  return { data, storage };
};

test('round-trips tabs and the active tab per user and organization', () => {
  const { storage } = fake();
  const key = navKey('u1', 'o1');
  saveNavState(key, { tabs: [{ id: 'a', categoryId: 'admin', subcategoryId: 'adm-overview' }, { id: 'b', categoryId: 'c', subcategoryId: null, panelId: 'p' }], activeId: 'b' }, 1000, storage);
  const restored = loadNavState(key, 2000, storage);
  assert.equal(restored?.activeId, 'b');
  assert.equal(restored?.tabs[1]?.panelId, 'p');
  assert.equal(loadNavState(navKey('u2', 'o1'), 2000, storage), null, 'another user never sees it');
  assert.equal(loadNavState(navKey('u1', 'o2'), 2000, storage), null, 'another tenant never sees it');
});

test('expired, corrupt and malicious payloads are ignored', () => {
  const day = 24 * 60 * 60_000;
  assert.equal(parseNavSnapshot(JSON.stringify({ tabs: [{ id: 'a', categoryId: 'x', subcategoryId: null }], activeId: 'a', savedAt: 0 }), day), null);
  assert.equal(parseNavSnapshot('{nope', 0), null);
  assert.equal(parseNavSnapshot(JSON.stringify({ tabs: [{ id: 1, categoryId: {} }], activeId: 'a', savedAt: 0 }), 0), null);
  const fixed = parseNavSnapshot(JSON.stringify({ tabs: [{ id: 'a', categoryId: 'x', subcategoryId: null }], activeId: 'missing', savedAt: 0 }), 1);
  assert.equal(fixed?.activeId, 'a', 'unknown active id falls back to the first tab');
});

test('clearNavState removes only navigation keys', () => {
  const { storage, data } = fake();
  storage.setItem('north-locale', 'es');
  saveNavState(navKey('u1', 'o1'), { tabs: [{ id: 'a', categoryId: 'x', subcategoryId: null }], activeId: 'a' }, 0, storage);
  clearNavState(storage);
  assert.deepEqual([...data.keys()], ['north-locale']);
});
