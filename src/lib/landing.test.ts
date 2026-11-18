import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { isLandingDraftValid, moveRule, type LandingPolicy } from './landingDraft.ts';

const base: LandingPolicy = { mode: 'STANDARD', defaultPanelId: null, updatedAt: null, rules: [] };

test('moveRule swaps neighbours and ignores out-of-range moves', () => {
  assert.deepEqual(moveRule(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveRule(['a', 'b'], 0, -1), ['a', 'b']);
  assert.deepEqual(moveRule(['a', 'b'], 1, 1), ['a', 'b']);
});

test('draft validity: PANEL needs a default, rules need one audience, a panel and no duplicates', () => {
  assert.equal(isLandingDraftValid(base), true);
  assert.equal(isLandingDraftValid({ ...base, mode: 'PANEL' }), false);
  assert.equal(isLandingDraftValid({ ...base, mode: 'PANEL', defaultPanelId: 'p' }), true);
  assert.equal(isLandingDraftValid({ ...base, rules: [{ role: 'VIEWER', panelId: '' }] }), false);
  assert.equal(isLandingDraftValid({ ...base, rules: [{ role: 'VIEWER', groupId: 'g', panelId: 'p' }] }), false);
  assert.equal(isLandingDraftValid({ ...base, rules: [{ role: 'VIEWER', panelId: 'p' }, { role: 'VIEWER', panelId: 'q' }] }), false);
  assert.equal(isLandingDraftValid({ ...base, rules: [{ role: 'VIEWER', panelId: 'p' }, { groupId: 'g', panelId: 'q' }] }), true);
});
