import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_RECENTS, parseRecents, pushRecent, type Recent } from './recents.ts';

const recent = (panelId: string, openedAt = 1): Recent => ({ panelId, categoryId: 'c', subcategoryId: 's', title: panelId, openedAt });

test('the newest panel goes first and a reopened panel is not duplicated', () => {
  const list = pushRecent(pushRecent([], recent('a', 1)), recent('b', 2));
  assert.deepEqual(list.map((item) => item.panelId), ['b', 'a']);
  assert.deepEqual(pushRecent(list, recent('a', 3)).map((item) => item.panelId), ['a', 'b']);
});

test('the list is capped', () => {
  let list: Recent[] = [];
  for (let index = 0; index < MAX_RECENTS + 5; index += 1) list = pushRecent(list, recent(`p${index}`, index));
  assert.equal(list.length, MAX_RECENTS);
  assert.equal(list[0]!.panelId, `p${MAX_RECENTS + 4}`);
});

test('malformed storage never breaks the Home', () => {
  assert.deepEqual(parseRecents(null), []);
  assert.deepEqual(parseRecents('not json'), []);
  assert.deepEqual(parseRecents('{"a":1}'), []);
  assert.deepEqual(parseRecents(JSON.stringify([{ panelId: 'a' }, recent('ok')])).map((item) => item.panelId), ['ok']);
});
