import { apiRequest } from '@/lib/api';
import type { DatasetField, DatasetSummary } from '@/features/admin-center/api';
import type { MappingInput, SheetAnalysis } from './mappingModel';

/** Typed adapters over the EXISTING import contracts (prepare -> signed PUT -> confirm -> analysis -> mapping -> activate). */
const base = (organizationId: string, datasetId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}/datasets/${encodeURIComponent(datasetId)}`;

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export type ImportJob = { id: string; datasetId: string; filename: string; size: number; status: string; scanStatus: string; progress: number; errorCode: string | null; completedAt: string | null };
export type SignedUpload = { url: string; method: 'PUT'; headers: Record<string, string>; expiresAt: string };
export type ImportAnalysis = { id: string; importId: string; parserVersion: string; workbook: { sheets: SheetAnalysis[] } };
export type MappingRecord = { id: string; version: number };

export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** A fresh idempotency key per attempt; a retry of the same file after a dropped connection reuses the same one. */
export const newIdempotencyKey = () => crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', '').slice(0, 8);

export const createDataset = (organizationId: string, input: { name: string; slug: string }) =>
  apiRequest<DatasetSummary>(`/v1/organizations/${encodeURIComponent(organizationId)}/datasets`, {
    method: 'POST', body: JSON.stringify({ name: { es: input.name, en: input.name }, slug: input.slug }),
  });

export const prepareImport = (organizationId: string, datasetId: string, file: { name: string; size: number }, checksum: string, idempotencyKey: string) =>
  apiRequest<{ import: ImportJob; upload: SignedUpload }>(`${base(organizationId, datasetId)}/imports`, {
    method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ filename: file.name, mime: XLSX_MIME, size: file.size, checksum }),
  });

/** PUT of the exact bytes to the short-lived private URL CORECROW signed. XHR (not fetch) so the person sees real progress. */
export function uploadToSignedUrl(upload: SignedUpload, file: Blob, onProgress: (fraction: number) => void, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) request.setRequestHeader(name, value);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onload = () => (request.status >= 200 && request.status < 300 ? resolve() : reject(new Error(`UPLOAD_${request.status}`)));
    request.onerror = () => reject(new Error('UPLOAD_NETWORK'));
    request.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', () => request.abort(), { once: true });
    request.send(file);
  });
}

export const confirmImport = (organizationId: string, datasetId: string, importId: string) =>
  apiRequest<ImportJob>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}/confirm`, { method: 'POST' });
export const readImport = (organizationId: string, datasetId: string, importId: string, signal?: AbortSignal) =>
  apiRequest<ImportJob>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}`, { signal });
export const cancelImport = (organizationId: string, datasetId: string, importId: string) =>
  apiRequest<ImportJob>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}/cancel`, { method: 'POST' });
export const readAnalysis = (organizationId: string, datasetId: string, importId: string) =>
  apiRequest<ImportAnalysis>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}/analysis`);
export const createMapping = (organizationId: string, datasetId: string, importId: string, input: MappingInput) =>
  apiRequest<MappingRecord>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}/mappings`, { method: 'POST', body: JSON.stringify(input) });
export const activateImport = (organizationId: string, datasetId: string, importId: string, mappingId: string) =>
  apiRequest<ImportJob>(`${base(organizationId, datasetId)}/imports/${encodeURIComponent(importId)}/activate`, { method: 'POST', body: JSON.stringify({ mappingId, mode: 'REPLACE_DATASET' }) });
export const fieldsOf = (organizationId: string, datasetId: string) => apiRequest<DatasetField[]>(`${base(organizationId, datasetId)}/fields`);
