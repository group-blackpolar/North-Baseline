import { apiRequest } from '@/lib/api';
import type { BindingQuery } from './bindingModel';

const orgPath = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}`;
const panelPath = (organizationId: string, panelId: string) => `${orgPath(organizationId)}/panels/${encodeURIComponent(panelId)}`;

export interface DraftIssue { severity: 'error' | 'warning'; code: string; message: string; sectionId?: string; componentId?: string }
export interface DraftDependency { kind: 'binding' | 'dataset'; id: string; status: 'ok' | 'missing' | 'unavailable' | 'forbidden'; componentIds: string[] }
export interface DraftReport {
  revisionId: string;
  revisionNumber: number;
  etag: string;
  checkedAt: string;
  valid: boolean;
  issues: DraftIssue[];
  dependencies: DraftDependency[];
}

/** Authoritative pre-publish check, evaluated by CORECROW against the saved draft (read-only). */
export const validateDraftOnServer = (organizationId: string, panelId: string, signal?: AbortSignal) =>
  apiRequest<DraftReport>(`${panelPath(organizationId, panelId)}/draft/validate`, { method: 'POST', signal });

export interface AllowedFilter { fieldId: string; operators: Array<'EQ' | 'NE' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'CONTAINS' | 'IN'> }
export interface PanelBinding {
  id: string;
  panelId: string;
  datasetId: string;
  name: string;
  query: BindingQuery & Record<string, unknown>;
  allowedFilters: AllowedFilter[];
  createdAt: string;
  updatedAt: string;
}

export const listPanelBindings = (organizationId: string, panelId: string, signal?: AbortSignal) =>
  apiRequest<PanelBinding[]>(`${panelPath(organizationId, panelId)}/analytics-bindings`, { signal });

export const createPanelBinding = (organizationId: string, panelId: string, input: { name: string; datasetId: string; query: unknown; allowedFilters?: AllowedFilter[] }) =>
  apiRequest<PanelBinding>(`${panelPath(organizationId, panelId)}/analytics-bindings`, { method: 'POST', body: JSON.stringify(input) });
