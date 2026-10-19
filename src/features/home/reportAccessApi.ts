import { apiRequest } from '@/lib/api';

export type ReportAccessState = 'ALLOWED' | 'RESTRICTED' | 'NOT_CONFIGURED';
export type ReportAccessTarget = { categoryId: string; categorySlug: string; subcategoryId: string; subcategorySlug: string; panelSlug: string };
export type ReportAccess = { slug: string; state: ReportAccessState; target: ReportAccessTarget | null };

/** One authorized request for every card. The answer is a display hint; CORECROW re-authorizes when a report is opened or queried. */
export const getReportAccess = (organizationId: string, slugs: string[], signal?: AbortSignal) =>
  apiRequest<ReportAccess[]>(`/v1/organizations/${encodeURIComponent(organizationId)}/report-access?categories=${encodeURIComponent(slugs.join(','))}`, { signal });
