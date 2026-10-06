import { API_BASE, ApiError, apiRequest } from '@/lib/api';
import { authHeaders } from '@/lib/auth';

/** Typed adapters over the CORECROW /documents contracts. CORECROW authorizes and audits every call. */
export type DocumentStatus = 'DRAFT' | 'READY' | 'SENT' | 'COMPLETED' | 'CANCELLED';
export type ChannelState = 'available' | 'not_configured';
export type Localized = Record<string, string>;

export type DocumentType = { id: string; key: string; name: Localized; referencePrefix: string; currency: string };
export type DocumentTypes = { types: DocumentType[]; channels: { email: ChannelState; whatsapp: ChannelState } };
export type DocumentItem = { id: string; position: number; name: string; description: string; sku: string | null; unit: string | null; quantity: string; unitPrice: string; total: string };
export type DocumentAttachment = { id: string; filename: string; mimeType: string; size: number; createdAt: string };
export type DocumentDetail = {
  id: string; reference: string; status: DocumentStatus; allowedTransitions: DocumentStatus[]; editable: boolean;
  type: { id: string; key: string; name: Localized; referencePrefix: string };
  date: string; client: { id: string | null; name: string; email: string | null; phone: string | null };
  comments: string; currency: string; items: DocumentItem[];
  subtotal: string; discountTotal: string; taxTotal: string; total: string;
  attachments: DocumentAttachment[]; version: number; createdBy: string; createdAt: string; updatedAt: string;
};
export type DocumentSummary = { id: string; reference: string; status: DocumentStatus; typeKey: string; clientName: string; date: string; total: string; currency: string; updatedAt: string };
export type DocumentEvent = { id: string; action: string; actorId: string | null; actorName: string | null; createdAt: string; metadata: Record<string, unknown> };
export type ClientSuggestion = { id: string; name: string; email: string | null; phone: string | null };

export type ItemDraft = { name: string; description: string; quantity: string; unitPrice: string };
export type ClientDraft = { id?: string; name?: string; email?: string | null; phone?: string | null };
export type DocumentPayload = { client: ClientDraft; items: ItemDraft[]; comments: string; date?: string };
export type ListQuery = { status?: DocumentStatus | ''; q?: string; from?: string; to?: string; cursor?: string; limit?: number };

const org = (id: string) => `/v1/organizations/${encodeURIComponent(id)}`;
const json = (body: unknown) => JSON.stringify(body);

export const listDocumentTypes = (o: string) => apiRequest<DocumentTypes>(`${org(o)}/document-types`);
export const searchClients = (o: string, q: string) => apiRequest<ClientSuggestion[]>(`${org(o)}/document-clients?q=${encodeURIComponent(q)}`);

export function listDocuments(o: string, typeId: string, query: ListQuery) {
  const params = new URLSearchParams({ typeId, limit: String(query.limit ?? 25) });
  if (query.status) params.set('status', query.status);
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.from) params.set('from', new Date(`${query.from}T00:00:00`).toISOString());
  if (query.to) params.set('to', new Date(`${query.to}T23:59:59`).toISOString());
  if (query.cursor) params.set('cursor', query.cursor);
  return apiRequest<{ items: DocumentSummary[]; nextCursor: string | null }>(`${org(o)}/documents?${params.toString()}`);
}
export const getDocument = (o: string, id: string) => apiRequest<DocumentDetail>(`${org(o)}/documents/${encodeURIComponent(id)}`);
export const createDocument = (o: string, typeId: string, payload: DocumentPayload) => apiRequest<DocumentDetail>(`${org(o)}/documents`, { method: 'POST', body: json({ typeId, ...payload }) });
export const updateDocument = (o: string, id: string, payload: DocumentPayload, expectedVersion: number) => apiRequest<DocumentDetail>(`${org(o)}/documents/${encodeURIComponent(id)}`, { method: 'PUT', body: json({ ...payload, expectedVersion }) });
export const changeDocumentStatus = (o: string, id: string, status: DocumentStatus) => apiRequest<DocumentDetail>(`${org(o)}/documents/${encodeURIComponent(id)}/status`, { method: 'POST', body: json({ status }) });
export const deleteDocument = (o: string, id: string) => apiRequest<{ id: string }>(`${org(o)}/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listDocumentEvents = (o: string, id: string) => apiRequest<DocumentEvent[]>(`${org(o)}/documents/${encodeURIComponent(id)}/events`);
export const removeAttachment = (o: string, id: string, attachmentId: string) => apiRequest<{ id: string }>(`${org(o)}/documents/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`, { method: 'DELETE' });
export const sendDocumentEmail = (o: string, id: string, body: { to?: string; subject?: string; message?: string; language: 'es' | 'en' }) => apiRequest<DocumentDetail>(`${org(o)}/documents/${encodeURIComponent(id)}/send/email`, { method: 'POST', body: json(body) });
export const sendDocumentWhatsApp = (o: string, id: string, body: { to?: string; message?: string; language: 'es' | 'en' }) => apiRequest<DocumentDetail>(`${org(o)}/documents/${encodeURIComponent(id)}/send/whatsapp`, { method: 'POST', body: json(body) });

/** Binary endpoints (PDF, images) cannot go through the JSON client. Errors keep the CORECROW message. */
async function binary(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'include', ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) } });
  if (!response.ok) {
    let message = response.statusText;
    let code: string | undefined;
    try { const body = await response.json(); message = body?.error?.message ?? message; code = body?.error?.code; } catch { /* no JSON body */ }
    throw new ApiError(response.status, message, code);
  }
  return response;
}
export async function fetchPdf(o: string, id: string, language: 'es' | 'en') {
  return (await binary(`${org(o)}/documents/${encodeURIComponent(id)}/pdf?lang=${language}`)).blob();
}
export async function fetchAttachment(o: string, id: string, attachmentId: string) {
  return (await binary(`${org(o)}/documents/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`)).blob();
}
export async function uploadAttachment(o: string, id: string, file: File) {
  const response = await binary(`${org(o)}/documents/${encodeURIComponent(id)}/attachments?filename=${encodeURIComponent(file.name)}`, { method: 'POST', body: file, headers: { 'Content-Type': file.type } });
  return (await response.json()) as DocumentAttachment;
}
