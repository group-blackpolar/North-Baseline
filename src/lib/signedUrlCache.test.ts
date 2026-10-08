import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { SignedUrlCache, type Signed } from './signedUrlCache.ts';

const setup = (results: Array<Signed | null | Error>) => {
  let clock = 1_000_000;
  let calls = 0;
  const cache = new SignedUrlCache(async () => {
    const next = results[Math.min(calls++, results.length - 1)];
    if (next instanceof Error) throw next;
    return next;
  }, () => clock);
  return { cache, tick: (ms: number) => { clock += ms; }, calls: () => calls, at: (ms: number) => new Date(clock + ms).toISOString() };
};

test('reuses a valid URL, dedupes concurrent fetches and refetches near expiry', async () => {
  const s = setup([{ url: 'u1', expiresAt: '' }, { url: 'u2', expiresAt: '' }]);
  const first = { url: 'u1', expiresAt: s.at(300_000) };
  const second = { url: 'u2', expiresAt: s.at(600_000) };
  const t = setup([first, second]);
  await Promise.all([t.cache.ensure('k'), t.cache.ensure('k')]);
  assert.equal(t.calls(), 1);
  assert.equal(t.cache.peek('k'), 'u1');
  await t.cache.ensure('k');
  assert.equal(t.calls(), 1, 'still valid');
  t.tick(280_000); // inside the 30 s skew window
  assert.equal(t.cache.peek('k'), null);
  await t.cache.ensure('k');
  assert.equal(t.cache.peek('k'), 'u2');
});

test('null (nothing stored) is cached until invalidated', async () => {
  const s = setup([null, { url: 'now-there', expiresAt: new Date(Date.now() + 600_000).toISOString() }]);
  await s.cache.ensure('k');
  assert.equal(s.cache.peek('k'), null);
  await s.cache.ensure('k');
  assert.equal(s.calls(), 1);
  s.cache.invalidate('k');
  await s.cache.ensure('k');
  assert.equal(s.calls(), 2);
});

test('a failed fetch backs off instead of retrying in a loop, and force retries', async () => {
  const s = setup([new Error('down'), { url: 'ok', expiresAt: '' }]);
  await s.cache.ensure('k');
  await s.cache.ensure('k');
  assert.equal(s.calls(), 1);
  assert.equal(s.cache.peek('k'), null);
  s.tick(60_000);
  await s.cache.ensure('k');
  assert.equal(s.calls(), 2);
});

test('subscribers are notified when a fetch settles and when invalidated', async () => {
  const s = setup([null]);
  let notified = 0;
  const off = s.cache.subscribe(() => notified++);
  await s.cache.ensure('k');
  s.cache.invalidate('k');
  off();
  s.cache.invalidate('k');
  assert.equal(notified, 2);
});
