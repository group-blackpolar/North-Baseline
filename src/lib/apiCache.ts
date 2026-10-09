// Level-1 (memory) cache for read-mostly CORECROW GETs. Framework-free and unit-tested with `node --test`.
//
// Rules this module enforces (CORECROW stays the authority; this only avoids repeating identical reads):
//  - Entries live in memory only. Nothing is written to disk, so a shared device never keeps another person's data.
//  - Every key is bound to a scope (user + inspection). Changing scope or calling clear() drops everything, so there
//    is no cross-user / cross-tenant reuse (tenant ids are part of every CORECROW path, hence part of every key).
//  - Concurrent identical reads share one request (deduplication).
//  - A stale entry may be served once while it is revalidated in the background (stale-while-revalidate); after
//    `staleMs` it is never served and the caller waits for the network.
//  - Any successful write invalidates by tag (`org:<id>`), so edits, publications, role changes, deletions and
//    permission changes are visible on the next read.

export interface CachePolicy {
  /** Fresh window: served without touching the network. */
  ttlMs: number;
  /** Extra window after `ttlMs` in which the stale value is served while a revalidation runs. 0 disables SWR. */
  staleMs?: number;
  /** Invalidation tags (e.g. `org:123`). */
  tags?: string[];
}

interface Entry { value: unknown; fetchedAt: number; staleMs: number; ttlMs: number; tags: string[] }

export interface CacheStats { hits: number; staleHits: number; misses: number; deduped: number; revalidations: number; evictions: number; size: number }

const MAX_ENTRIES = 300;

export class ApiCache {
  private readonly entries = new Map<string, Entry>();
  private readonly inflight = new Map<string, Promise<unknown>>();
  private scope = '';
  private generation = 0;
  private counters = { hits: 0, staleHits: 0, misses: 0, deduped: 0, revalidations: 0, evictions: 0 };
  private readonly now: () => number;

  constructor(now: () => number = Date.now) { this.now = now; }

  /** Binds the cache to a user/inspection scope. A different scope empties it. */
  setScope(scope: string) {
    if (scope === this.scope) return;
    this.scope = scope;
    this.clear();
  }

  clear() {
    this.generation += 1; // responses that were in flight belong to the old scope/session and must not be stored
    this.entries.clear();
    this.inflight.clear();
  }

  invalidateTag(tag: string) {
    this.generation += 1;
    for (const [key, entry] of this.entries) if (entry.tags.includes(tag)) this.entries.delete(key);
    // in-flight reads started before the write may carry the pre-write state: they must not repopulate the cache
    this.inflight.clear();
  }

  invalidateKey(key: string) { this.entries.delete(key); this.inflight.delete(key); }

  peek<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    return entry ? (entry.value as T) : undefined;
  }

  stats(): CacheStats {
    return { ...this.counters, size: this.entries.size };
  }

  get<T>(key: string, fetcher: () => Promise<T>, policy: CachePolicy, options: { force?: boolean } = {}): Promise<T> {
    const entry = this.entries.get(key);
    const age = entry ? this.now() - entry.fetchedAt : Infinity;
    if (entry && !options.force && age < policy.ttlMs) {
      this.counters.hits += 1;
      return Promise.resolve(entry.value as T);
    }
    const staleMs = policy.staleMs ?? 0;
    if (entry && !options.force && staleMs > 0 && age < policy.ttlMs + staleMs) {
      this.counters.staleHits += 1;
      this.counters.revalidations += 1;
      void this.load(key, fetcher, policy).catch(() => undefined); // background; the stale value stays until replaced
      return Promise.resolve(entry.value as T);
    }
    return this.load(key, fetcher, policy);
  }

  private load<T>(key: string, fetcher: () => Promise<T>, policy: CachePolicy): Promise<T> {
    const existing = this.inflight.get(key);
    if (existing) { this.counters.deduped += 1; return existing as Promise<T>; }
    this.counters.misses += 1;
    const generation = this.generation;
    const promise = fetcher().then(
      (value) => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
        if (generation === this.generation) this.store(key, value, policy);
        return value;
      },
      (error) => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
        throw error; // a failure never evicts the last good value: a stale read can still be served later
      },
    );
    this.inflight.set(key, promise);
    return promise;
  }

  private store(key: string, value: unknown, policy: CachePolicy) {
    this.entries.delete(key); // re-insert so Map order is recency order
    this.entries.set(key, { value, fetchedAt: this.now(), ttlMs: policy.ttlMs, staleMs: policy.staleMs ?? 0, tags: policy.tags ?? [] });
    while (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
      this.counters.evictions += 1;
    }
  }
}

/** Tag every path with the organization it belongs to so a write can invalidate exactly its tenant. */
export function tagsForPath(path: string): string[] {
  const match = /^\/v1\/organizations\/([^/?#]+)/.exec(path);
  if (match) return [`org:${match[1]}`, 'orgs'];
  if (path.startsWith('/v1/organizations') || path.startsWith('/v1/me') || path.startsWith('/v1/invitations')) return ['orgs'];
  if (path.startsWith('/v1/platform')) return ['platform'];
  return [];
}

/** Tags a successful non-GET request makes stale. */
export function tagsInvalidatedByWrite(path: string): string[] {
  const match = /^\/v1\/organizations\/([^/?#]+)/.exec(path);
  if (match) return [`org:${match[1]}`, 'orgs'];
  if (path.startsWith('/v1/organizations') || path.startsWith('/v1/invitations') || path.startsWith('/v1/commerce')) return ['orgs'];
  if (path.startsWith('/v1/platform')) return ['platform', 'orgs'];
  return [];
}

export const apiCache = new ApiCache();
