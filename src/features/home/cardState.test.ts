import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveCardState, type AccessLookup } from './cardState.ts';

const rows = (entries: Array<[string, 'ALLOWED' | 'RESTRICTED' | 'NOT_CONFIGURED']>): AccessLookup => ({ status: 'ready', rows: new Map(entries.map(([slug, state]) => [slug, { slug, state, target: null }])) });

test('card states come from the server summary and never default to access', () => {
  const ready = rows([['a', 'ALLOWED'], ['b', 'RESTRICTED'], ['c', 'NOT_CONFIGURED']]);
  assert.deepEqual(['a', 'b', 'c'].map((slug) => deriveCardState(ready, slug)), ['allowed', 'restricted', 'unavailable']);
  assert.equal(deriveCardState(ready, 'missing'), 'unknown');
  assert.equal(deriveCardState({ status: 'error' }, 'a'), 'unknown');
  assert.equal(deriveCardState({ status: 'loading' }, 'a'), 'loading');
});
