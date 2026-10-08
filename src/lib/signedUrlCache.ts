// Framework-free cache of short-lived signed URLs (avatars, organization icons). Unit-tested with `node --test`.

export interface Signed { url: string; expiresAt: string }
interface Entry { url: string | null; expires: number; inflight: Promise<void> | null }

const FAILURE_BACKOFF_MS = 15_000;

/**
 * One entry per key. A URL is reused until `skewMs` before it expires, concurrent requests share one fetch, `null`
 * (nothing stored) is cached until invalidated, and a failed fetch is retried after a short backoff instead of in a loop.
 */
export class SignedUrlCache {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();

  private readonly fetcher: (key: string) => Promise<Signed | null>;
  private readonly now: () => number;
  private readonly skewMs: number;

  constructor(fetcher: (key: string) => Promise<Signed | null>, now: () => number = Date.now, skewMs = 30_000) {
    this.fetcher = fetcher; this.now = now; this.skewMs = skewMs;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private emit() { this.listeners.forEach((listener) => listener()); }

  /** Current usable URL, or null (also while expired or not loaded). */
  peek(key: string): string | null {
    const entry = this.entries.get(key);
    return entry && entry.expires - this.skewMs > this.now() ? entry.url : null;
  }

  ensure(key: string, force = false): Promise<void> {
    const entry = this.entries.get(key);
    if (entry?.inflight) return entry.inflight;
    if (!force && entry && entry.expires - this.skewMs > this.now()) return Promise.resolve();
    const inflight = this.fetcher(key).then(
      (signed) => { this.entries.set(key, { url: signed?.url ?? null, expires: signed ? Date.parse(signed.expiresAt) : Infinity, inflight: null }); },
      () => { this.entries.set(key, { url: null, expires: this.now() + FAILURE_BACKOFF_MS + this.skewMs, inflight: null }); },
    ).then(() => this.emit());
    this.entries.set(key, { url: entry?.url ?? null, expires: entry?.expires ?? 0, inflight });
    return inflight;
  }

  /** Forget a key (e.g. after the stored image changed) so the next reader refetches. */
  invalidate(key: string) { this.entries.delete(key); this.emit(); }
}
