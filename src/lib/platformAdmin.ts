import { apiRequest } from '@/lib/api'

/** Platform Administration client.
 *
 * Every call goes through `apiRequest`, the single authenticated transport used
 * by the rest of NORTH. Components must never call `fetch()` directly, and no
 * caller may infer authorization from these types: CORECROW decides. */

export type GlobalRole = 'USER' | 'DEVELOPER' | 'ADMIN' | 'SUPERADMIN'
export type AccountStatus = 'ACTIVE' | 'SUSPENDED'
export type TenantRole = 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER' | 'VIEWER'
export type OrganizationStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'
export type BillingStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CLOSED'

export type Page<T> = { items: T[]; nextCursor: string | null }

export type PlatformUser = {
  id: string
  email: string
  name: string | null
  role: GlobalRole
  status: AccountStatus
  emailVerified: boolean
  passwordChangeRequired: boolean
  termsAcceptedAt: string | null
  termsVersion: string | null
  createdAt: string
}

export type PlatformMembership = {
  id: string
  role: TenantRole
  createdAt: string
  organization: { id: string; name: string; slug: string; status: OrganizationStatus }
}

export type PlatformUserDetail = PlatformUser & { memberships: PlatformMembership[] }

export type PlatformOrganization = {
  id: string
  name: string
  slug: string
  status: OrganizationStatus
  createdAt: string
  updatedAt: string
  homePanelId: string | null
  owner: { id: string; name: string | null; email: string } | null
  memberCount: number
  groupCount: number
  billingStatus: BillingStatus | null
  billingCurrency: string | null
}

export type PlatformOrganizationDetail = PlatformOrganization & {
  invitationCount: number
  groups: Array<{
    id: string
    name: string
    description: string | null
    createdAt: string
    updatedAt: string
    memberCount: number
    permissionCount: number
  }>
  billingProfile: {
    id: string
    status: BillingStatus
    currency: string
    basePriceMinor: number
    memberPriceMinor: number
    billingEmail: string | null
    createdAt: string
    updatedAt: string
  } | null
}

export type PlatformSummary = {
  users: { total: number; active: number; suspended: number; verified: number; createdLast7Days: number; createdLast30Days: number }
  organizations: { total: number; active: number; suspended: number; createdLast30Days: number }
  memberships: { total: number }
  sessions: { active: number }
  storage: { usedBytes: string; limitBytes: string; reservedBytes: string }
  billing: {
    currency: 'USD'
    basePriceMinor: number
    memberPriceMinor: number
    billableOrganizationCount: number
    billableMemberCount: number
    estimatedMonthlyMinor: number
  }
  generatedAt: string
}

export type PlatformAuditEvent = {
  id: string
  actorId: string | null
  organizationId: string | null
  action: string
  targetType: string | null
  targetId: string | null
  requestId: string | null
  metadata: unknown
  createdAt: string
}

export type PlatformAuditQuery = {
  limit?: number
  cursor?: string
  action?: string
  actorId?: string
  targetType?: string
  targetId?: string
  from?: string
  to?: string
}

export type PlatformBillingSummary = {
  currency: 'USD'
  basePriceMinor: number
  memberPriceMinor: number
  groupsCostMinor: number
  organizationCount: number
  billableMemberCount: number
  estimatedMonthlyMinor: number
  byStatusScope: 'ALL_PROFILES'
  byStatus: Array<{ status: BillingStatus; count: number }>
}

/** Contact requests as returned by the existing `GET /v1/contact` contract. */
export type ContactRequest = {
  id: string
  name: string
  email: string
  organization: string
  country: string
  project: string
  message: string
  locale: 'es-lat' | 'en-us'
  createdAt: string
  consentAt: string
}

export type PlatformTemplate = {
  id: string
  slug: string
  name: Record<string, string>
  description: Record<string, string> | null
  status: string
  currentVersion: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type NorthPlatformGrant = {
  userId: string
  capability: string
  createdAt: string
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function getPlatformSummary() {
  return apiRequest<PlatformSummary>('/v1/platform/summary')
}

export function listPlatformUsers(params: { q?: string; limit?: number; cursor?: string } = {}) {
  return apiRequest<Page<PlatformUser>>(`/v1/platform/users${query({ limit: 25, ...params })}`)
}

export function getPlatformUser(id: string) {
  return apiRequest<PlatformUserDetail>(`/v1/platform/users/${encodeURIComponent(id)}`)
}

export function listPlatformOrganizations(params: { q?: string; limit?: number; cursor?: string } = {}) {
  return apiRequest<Page<PlatformOrganization>>(`/v1/platform/organizations${query({ limit: 25, ...params })}`)
}

export function getPlatformOrganization(id: string) {
  return apiRequest<PlatformOrganizationDetail>(`/v1/platform/organizations/${encodeURIComponent(id)}`)
}

export function listPlatformAudit(params: PlatformAuditQuery = {}) {
  return apiRequest<{ items: PlatformAuditEvent[]; nextCursor: string | null }>(
    `/v1/platform/audit${query({ limit: 50, ...params })}`
  )
}

export function getPlatformBillingSummary() {
  return apiRequest<PlatformBillingSummary>('/v1/platform/billing/summary')
}

export function listContacts(limit = 50) {
  return apiRequest<ContactRequest[]>(`/v1/contact${query({ limit })}`)
}

export function listPlatformTemplates() {
  return apiRequest<PlatformTemplate[]>('/v1/platform/north/templates')
}

export function listUserNorthCapabilities(userId: string) {
  return apiRequest<NorthPlatformGrant[]>(
    `/v1/platform/users/${encodeURIComponent(userId)}/north-capabilities`
  )
}

