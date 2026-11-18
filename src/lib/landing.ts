import { apiRequest } from '@/lib/api';

// ADR 027 (CoreCrow). The landing is a stored policy; the server resolves where each member lands.
export * from './landingDraft';
import type { LandingPolicy, LandingResolution } from './landingDraft';

const path = (organizationId: string) => `/v1/organizations/${encodeURIComponent(organizationId)}/landing`;

export const getLanding = (organizationId: string) => apiRequest<LandingPolicy>(path(organizationId));
export const resolveLanding = (organizationId: string) => apiRequest<LandingResolution>(`${path(organizationId)}/resolve`);
export const saveLanding = (organizationId: string, policy: LandingPolicy) =>
  apiRequest<LandingPolicy>(path(organizationId), {
    method: 'PUT',
    body: JSON.stringify({ mode: policy.mode, defaultPanelId: policy.mode === 'PANEL' ? policy.defaultPanelId : null, rules: policy.mode === 'NONE' ? [] : policy.rules.map(({ role, groupId, panelId }) => ({ ...(role ? { role } : { groupId }), panelId })), expectedUpdatedAt: policy.updatedAt }),
  });

