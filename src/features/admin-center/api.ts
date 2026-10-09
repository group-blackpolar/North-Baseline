import { API_BASE, apiRequest, cachedGet } from '@/lib/api';

/** Typed adapters over EXISTING CORECROW contracts only (no parallel API). CORECROW authorizes every call. */
const org = (id: string) => `/v1/organizations/${encodeURIComponent(id)}`;

export type OrganizationDetail = {
  id: string; name: string; slug: string; status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; createdAt: string; updatedAt: string;
  homePanelId?: string | null; iconData?: string | null; iconAssetId?: string | null; description?: string | null;
};
export const getOrganizationDetail = (organizationId: string, force = false) =>
  cachedGet<OrganizationDetail>(org(organizationId), { ttlMs: 10_000, staleMs: 30_000 }, { force });

export type BillingAccount = {
  id: string; organizationId: string; status: 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CLOSED'; currency: 'USD'; basePriceMinor: number; memberPriceMinor: number;
  billingEmail?: string | null; createdAt: string; updatedAt: string; billableMemberCount: number; groupsCostMinor: number; estimatedMonthlyMinor: number;
};
export const getBilling = (organizationId: string) => cachedGet<BillingAccount>(`${org(organizationId)}/billing`, { ttlMs: 15_000 });
export const updateBillingEmail = (organizationId: string, billingEmail: string | null) =>
  apiRequest<BillingAccount>(`${org(organizationId)}/billing`, { method: 'PATCH', body: JSON.stringify({ billingEmail }) });

export type Entitlement = { id: string; organizationId: string; subscriptionId: string; productCode: string; feature: string; expiresAt: string; revokedAt?: string | null };
export type Invoice = { id: string; subscriptionId: string; amountMinor: number; currency: string; status: string; createdAt: string };
export type Subscription = { id: string; organizationId: string; planId: string; status: string; startsAt: string; endsAt: string; createdAt: string; invoices: Invoice[]; entitlements: Entitlement[] };
export const listSubscriptions = (organizationId: string) => cachedGet<Subscription[]>(`${org(organizationId)}/subscriptions`, { ttlMs: 15_000 });
export const listEntitlements = (organizationId: string) => cachedGet<Entitlement[]>(`${org(organizationId)}/entitlements`, { ttlMs: 15_000 });

export const setOrganizationStatus = (organizationId: string, status: 'ACTIVE' | 'ARCHIVED') =>
  apiRequest<OrganizationDetail>(`${org(organizationId)}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });

export type AuditEntry = {
  id: string; actorId?: string | null; organizationId?: string | null; action: string; targetType?: string | null; targetId?: string | null;
  requestId?: string | null; metadata?: unknown; createdAt: string;
};
export const listAuditEntries = (organizationId: string, options: { limit?: number; before?: string } = {}) =>
  apiRequest<AuditEntry[]>(`${org(organizationId)}/audit?limit=${options.limit ?? 50}${options.before ? `&before=${encodeURIComponent(options.before)}` : ''}`);

export type DatasetSummary = {
  id: string; organizationId: string; name: Record<string, string>; description?: Record<string, string> | null; slug: string; status: 'ACTIVE' | 'ARCHIVED';
  currentSchemaVersionId?: string | null; createdBy: string; createdAt: string; updatedAt: string;
};
export type DatasetFieldType = 'TEXT' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE' | 'DATETIME' | 'TIME';
export type DatasetField = {
  id: string; datasetId: string; key: string; displayName: Record<string, string>; description?: Record<string, string> | null; canonicalType: DatasetFieldType;
  semanticType?: string | null; nullable: boolean; status: 'ACTIVE' | 'DEPRECATED'; createdAt: string; updatedAt: string;
};
export type DatasetImport = { id: string; status: string; createdAt: string; updatedAt?: string; [key: string]: unknown };
export type SchemaVersion = { id: string; version?: number; createdAt: string; [key: string]: unknown };

export const listDatasets = (organizationId: string) => cachedGet<DatasetSummary[]>(`${org(organizationId)}/datasets`, { ttlMs: 20_000, staleMs: 60_000 });
export const listDatasetFields = (organizationId: string, datasetId: string) => cachedGet<DatasetField[]>(`${org(organizationId)}/datasets/${encodeURIComponent(datasetId)}/fields`, { ttlMs: 30_000, staleMs: 60_000 });
export const listDatasetImports = (organizationId: string, datasetId: string) => cachedGet<DatasetImport[]>(`${org(organizationId)}/datasets/${encodeURIComponent(datasetId)}/imports`, { ttlMs: 15_000 });
export const listSchemaVersions = (organizationId: string, datasetId: string) => cachedGet<SchemaVersion[]>(`${org(organizationId)}/datasets/${encodeURIComponent(datasetId)}/schema-versions`, { ttlMs: 30_000 });

/** Public liveness probe of CORECROW itself (the only "connection" NORTH can verify without a connector registry). */
export async function probeApiHealth(): Promise<{ ok: boolean; status: number; latencyMs: number }> {
  const started = performance.now();
  try {
    const response = await fetch(`${API_BASE}/v1/health`, { credentials: 'omit' });
    return { ok: response.ok, status: response.status, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, status: 0, latencyMs: Math.round(performance.now() - started) };
  }
}

export const formatMinor = (minor: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 }).format(minor / 100);
