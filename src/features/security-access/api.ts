import { apiRequest } from '@/lib/api';

/** Typed adapters over the CORECROW "Security and access" contracts. CORECROW authorizes every call (security.* permissions). */
const base = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}/security`;
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) });

export type Overflow = 'BLOCK_NEW' | 'REPLACE_OLDEST' | 'REQUIRE_USER_CHOICE';
export type Policy = {
  configured: boolean; enforcement: boolean; maxDevices: number | null; maxSessions: number | null; overflowPolicy: Overflow; alertsEnabled: boolean;
  retentionDays: number; retentionExemption: { until: string; reason: string; by: string | null } | null; updatedAt: string | null;
};
export type Overview = {
  policy: Policy; activeDevices: number; activeSessions: number; openAlerts: number; allowRules: number; denyRules: number;
  lastRetentionRun: { ranAt: string; purgedAlerts: number; purgedDevices: number; skipped: string | null } | null;
};
export type Device = { id: string; userId: string; userName: string | null; userEmail: string; userAgent: string | null; firstIp: string | null; lastIp: string | null; firstSeenAt: string; lastSeenAt: string; revokedAt: string | null; activeSessions: number };
export type SessionRow = { id: string; userId: string; userName: string | null; userEmail: string; ipAddress: string | null; userAgent: string | null; deviceId: string | null; createdAt: string; expiresAt: string };
export type SecurityUser = { userId: string; name: string | null; email: string; role: string; status: string; mailbox: 'verified' | 'unverified' | 'organization'; passwordChangeRequired: boolean; activeSessions: number; lastSessionAt: string | null; activeDevices: number };
export type IpRule = { id: string; kind: 'ALLOW' | 'DENY'; cidr: string; note: string | null; createdAt: string };
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type Alert = { id: string; kind: string; severity: string; userId: string | null; count: number; details: unknown; status: AlertStatus; emailStatus: 'NONE' | 'SENT' | 'FAILED'; emailError: string | null; firstSeenAt: string; lastSeenAt: string };
export type SecurityAudit = { id: string; actorId: string | null; action: string; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: string };
export type Notifications = { alertEmailEnabled: boolean; alertEmailRecipients: string[] };
export type PolicyInput = Omit<Policy, 'configured' | 'updatedAt' | 'retentionExemption'> & { retentionExemption: { until: string; reason: string } | null };

export const getOverview = (organizationId: string) => apiRequest<Overview>(`${base(organizationId)}/overview`);
export const listDevices = (organizationId: string, includeRevoked: boolean) => apiRequest<Device[]>(`${base(organizationId)}/devices?includeRevoked=${includeRevoked}`);
export const revokeDevice = (organizationId: string, id: string) => apiRequest<{ id: string; sessionsEnded: number }>(`${base(organizationId)}/devices/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listSessions = (organizationId: string) => apiRequest<SessionRow[]>(`${base(organizationId)}/sessions`);
export const revokeSession = (organizationId: string, id: string) => apiRequest<{ id: string }>(`${base(organizationId)}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listSecurityUsers = (organizationId: string) => apiRequest<SecurityUser[]>(`${base(organizationId)}/users`);
export const revokeUserSessions = (organizationId: string, userId: string) => apiRequest<{ sessionsEnded: number }>(`${base(organizationId)}/users/${encodeURIComponent(userId)}/sessions`, { method: 'DELETE' });
export const listIpRules = (organizationId: string) => apiRequest<IpRule[]>(`${base(organizationId)}/ips`);
export const addIpRule = (organizationId: string, input: { kind: 'ALLOW' | 'DENY'; cidr: string; note?: string }) => apiRequest<IpRule>(`${base(organizationId)}/ips`, json('POST', input));
export const removeIpRule = (organizationId: string, id: string) => apiRequest<{ id: string }>(`${base(organizationId)}/ips/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const getPolicy = (organizationId: string) => apiRequest<Policy>(`${base(organizationId)}/policy`);
export const savePolicy = (organizationId: string, input: PolicyInput) => apiRequest<Policy>(`${base(organizationId)}/policy`, json('PUT', input));
export const getNotifications = (organizationId: string) => apiRequest<Notifications>(`${base(organizationId)}/notifications`);
export const saveNotifications = (organizationId: string, input: Notifications) => apiRequest<Notifications>(`${base(organizationId)}/notifications`, json('PUT', input));
export const listAlerts = (organizationId: string, status?: AlertStatus) => apiRequest<Alert[]>(`${base(organizationId)}/alerts${status ? `?status=${status}` : ''}`);
export const setAlertStatus = (organizationId: string, id: string, status: AlertStatus) => apiRequest<{ id: string; status: AlertStatus }>(`${base(organizationId)}/alerts/${encodeURIComponent(id)}`, json('PATCH', { status }));
export const listSecurityAudit = (organizationId: string, before?: string) => apiRequest<SecurityAudit[]>(`${base(organizationId)}/audit?limit=50${before ? `&before=${encodeURIComponent(before)}` : ''}`);
