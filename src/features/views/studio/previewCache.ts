import { queryDataset, type DatasetQueryRequest, type DatasetQueryResponse } from '@/features/analytics/datasetQuery';
import type { PanelBinding } from './studioApi';

// Small in-memory cache so several components bound to the same binding share one request while editing.
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<DatasetQueryResponse> }>();

export function cachedQuery(organizationId: string, binding: PanelBinding): Promise<DatasetQueryResponse> {
  const key = `${organizationId}:${binding.datasetId}:${JSON.stringify(binding.query)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.promise;
  const promise = queryDataset(organizationId, binding.datasetId, binding.query as unknown as DatasetQueryRequest);
  promise.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), promise });
  if (cache.size > 50) cache.delete(cache.keys().next().value as string);
  return promise;
}

export const clearPreviewCache = () => cache.clear();
