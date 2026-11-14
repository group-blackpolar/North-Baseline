import { API_BASE } from '@/lib/api';

export type PlatformStatus = {
  operational: boolean;
  modules: Array<{ name: string; available: boolean }>;
  p95Ms: number | null;
  requests: number;
  errors5xx: number;
  /** Requests per bucket over the window, oldest first. */
  series: number[];
};

type Summary = { requests?: number; latencyMs?: { p95?: number | null }; errors?: { server?: number }; series?: Array<{ requests?: number }> };
type Health = { modules?: Array<{ name: string; status: string }> };

/** Public, sanitized aggregates only (no tenant data): readiness from /v1/health and 24 h traffic from /v1/status/summary. */
export async function fetchPlatformStatus(): Promise<PlatformStatus> {
  const [health, summary] = await Promise.all([
    fetch(`${API_BASE}/v1/health`, { credentials: 'omit' }),
    fetch(`${API_BASE}/v1/status/summary?window=24h`, { credentials: 'omit' }),
  ]);
  const healthBody = (await health.json().catch(() => ({}))) as Health;
  const body = summary.ok ? ((await summary.json()) as Summary) : null;
  return {
    operational: health.ok,
    modules: (healthBody.modules ?? []).map((module) => ({ name: module.name, available: module.status === 'available' })),
    p95Ms: body?.latencyMs?.p95 ?? null,
    requests: body?.requests ?? 0,
    errors5xx: body?.errors?.server ?? 0,
    series: (body?.series ?? []).map((bucket) => bucket.requests ?? 0),
  };
}
