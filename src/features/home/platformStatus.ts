import { API_BASE } from '@/lib/api';

export type PlatformStatus = { operational: boolean; p95Ms: number | null; requests: number; errors5xx: number };

/** Public, sanitized aggregates only (no tenant data): readiness from /v1/health and 24 h traffic from /v1/status/summary. */
export async function fetchPlatformStatus(): Promise<PlatformStatus> {
  const [health, summary] = await Promise.all([
    fetch(`${API_BASE}/v1/health`, { credentials: 'omit' }),
    fetch(`${API_BASE}/v1/status/summary?window=24h`, { credentials: 'omit' }),
  ]);
  const body = summary.ok ? ((await summary.json()) as { requests?: number; latencyMs?: { p95?: number | null }; errors?: { server?: number; errors5xx?: number } }) : null;
  return {
    operational: health.ok,
    p95Ms: body?.latencyMs?.p95 ?? null,
    requests: body?.requests ?? 0,
    errors5xx: body?.errors?.server ?? body?.errors?.errors5xx ?? 0,
  };
}
