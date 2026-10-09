import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';

export type ResourceStatus = 'loading' | 'ready' | 'forbidden' | 'error';
export interface Resource<T> { status: ResourceStatus; data: T | null; error: string | null; reload: () => Promise<void> }

/**
 * One independent read. A 403/404 from CORECROW is `forbidden` (you may not see this), anything else is `error`
 * (retry) — the two are never mixed. While reloading, the previous data stays on screen (no blanking).
 */
export function useResource<T>(load: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [state, setState] = useState<{ status: ResourceStatus; data: T | null; error: string | null }>({ status: 'loading', data: null, error: null });
  const loadRef = useRef(load);
  loadRef.current = load;
  const generation = useRef(0);

  const run = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const data = await loadRef.current();
      if (mine === generation.current) setState({ status: 'ready', data, error: null });
    } catch (reason) {
      if (mine !== generation.current) return;
      const status = reason instanceof ApiError ? reason.status : 0;
      const message = reason instanceof Error ? reason.message : 'Request failed';
      setState((current) => ({ status: status === 403 || status === 404 ? 'forbidden' : 'error', data: status === 403 || status === 404 ? null : current.data, error: message }));
    }
  }, []);

  useEffect(() => {
    generation.current += 1;
    setState({ status: 'loading', data: null, error: null });
    void run();
    return () => { generation.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, reload: run };
}

/** Runs `worker` over `items` with bounded parallelism, preserving order. Used where one request per row is unavoidable. */
export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(lanes);
  return results;
}
