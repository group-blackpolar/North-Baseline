import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ApiCache, tagsForPath, tagsInvalidatedByWrite } from './apiCache.ts';

const clock = () => { let now = 0; return { now: () => now, tick: (ms: number) => { now += ms; } }; };
const counter = <T,>(value: (n: number) => T) => { let n = 0; return { fn: async () => value(++n), calls: () => n }; };

test('serves fresh entries without a request and deduplicates concurrent reads', async () => {
  const c = clock(); const cache = new ApiCache(c.now); const src = counter((n) => `v${n}`);
  const [a, b] = await Promise.all([cache.get('k', src.fn, { ttlMs: 1000 }), cache.get('k', src.fn, { ttlMs: 1000 })]);
  assert.equal(a, 'v1'); assert.equal(b, 'v1'); assert.equal(src.calls(), 1);
  c.tick(500);
  assert.equal(await cache.get('k', src.fn, { ttlMs: 1000 }), 'v1');
  assert.equal(src.calls(), 1);
  assert.deepEqual({ ...cache.stats() }, { hits: 1, staleHits: 0, misses: 1, deduped: 1, revalidations: 0, evictions: 0, size: 1 });
});

test('stale-while-revalidate returns the old value once and refreshes in the background', async () => {
  const c = clock(); const cache = new ApiCache(c.now); const src = counter((n) => `v${n}`);
  await cache.get('k', src.fn, { ttlMs: 100, staleMs: 1000 });
  c.tick(200);
  assert.equal(await cache.get('k', src.fn, { ttlMs: 100, staleMs: 1000 }), 'v1');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(src.calls(), 2);
  assert.equal(await cache.get('k', src.fn, { ttlMs: 100, staleMs: 1000 }), 'v2');
  c.tick(5000); // beyond ttl + stale: must wait for the network
  assert.equal(await cache.get('k', src.fn, { ttlMs: 100, staleMs: 1000 }), 'v3');
});

test('a write invalidates its tenant only, and in-flight pre-write reads are not stored', async () => {
  const cache = new ApiCache(); const a = counter((n) => `a${n}`); const b = counter((n) => `b${n}`);
  await cache.get('/v1/organizations/o1/x', a.fn, { ttlMs: 10_000, tags: ['org:o1'] });
  await cache.get('/v1/organizations/o2/x', b.fn, { ttlMs: 10_000, tags: ['org:o2'] });
  cache.invalidateTag('org:o1');
  assert.equal(cache.peek('/v1/organizations/o1/x'), undefined);
  assert.equal(cache.peek('/v1/organizations/o2/x'), 'b1');
  let release!: (v: string) => void;
  const slow = new Promise<string>((resolve) => { release = resolve; });
  const pending = cache.get('/v1/organizations/o1/y', () => slow, { ttlMs: 10_000, tags: ['org:o1'] });
  cache.invalidateTag('org:o1');
  release('stale-before-write');
  assert.equal(await pending, 'stale-before-write');
  assert.equal(cache.peek('/v1/organizations/o1/y'), undefined);
});

test('changing scope (user switch / logout) drops everything', async () => {
  const cache = new ApiCache(); const src = counter((n) => n);
  cache.setScope('user-1');
  await cache.get('k', src.fn, { ttlMs: 10_000 });
  cache.setScope('user-1');
  assert.equal(cache.peek('k'), 1);
  cache.setScope('user-2');
  assert.equal(cache.peek('k'), undefined);
});

test('a failed refresh does not evict the last good value and is not cached', async () => {
  const c = clock(); const cache = new ApiCache(c.now);
  await cache.get('k', async () => 'good', { ttlMs: 10, staleMs: 1000 });
  c.tick(20);
  await assert.rejects(cache.get('k', async () => { throw new Error('down'); }, { ttlMs: 10 }));
  assert.equal(cache.peek('k'), 'good');
});

test('tags derive from the organization in the path', () => {
  assert.deepEqual(tagsForPath('/v1/organizations/abc/members'), ['org:abc', 'orgs']);
  assert.deepEqual(tagsInvalidatedByWrite('/v1/organizations/abc/groups'), ['org:abc', 'orgs']);
  assert.deepEqual(tagsForPath('/v1/platform/users'), ['platform']);
});
