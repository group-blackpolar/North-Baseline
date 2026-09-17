import { apiRequest } from '@/lib/api';

export interface Entitlements {
  plan: string;
  limits: {
    organizationLimit: number | null;
    workspaceLimit: number | null;
    seatCount: number | null;
  };
}

/** null = CoreCrow aún no expone entitlements para esta org (no gatear creación todavía) */
export async function fetchEntitlements(organizationId: string): Promise<Entitlements | null> {
  try {
    return await apiRequest<Entitlements>(`/v1/organizations/${organizationId}/entitlements`);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 501) return null;
    throw error;
  }
}