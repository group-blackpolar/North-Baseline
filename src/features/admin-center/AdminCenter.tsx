import { ViewsCenter } from '@/features/views/ViewsCenter';
import { QueriesCenter } from '@/features/queries/QueriesCenter';
import type { AdminSection } from './sections';
import { AuditCenter } from './AuditCenter';
import { BillingScreen } from './BillingScreen';
import { IntegrationsScreen } from './IntegrationsScreen';
import { MembersScreen } from './MembersScreen';
import { OrgSettingsScreen } from './OrgSettingsScreen';
import { OverviewScreen } from './OverviewScreen';

/**
 * Organization Administration. One screen per capability; the section comes from the catalog subcategory the person
 * opened (the existing category/subcategory/tab system — there is no second navigation). Each screen is remounted per
 * organization, so no list, draft or filter can survive a tenant switch.
 */
export function AdminCenter({ section, organizationId, currentUserId }: { section: AdminSection; organizationId: string; currentUserId: string }) {
  const key = `${organizationId}:${section}`;
  switch (section) {
    case 'overview': return <OverviewScreen key={key} organizationId={organizationId} />;
    case 'members': return <MembersScreen key={key} organizationId={organizationId} currentUserId={currentUserId} />;
    case 'views': return <ViewsCenter key={key} organizationId={organizationId} />;
    case 'queries': return <QueriesCenter key={key} organizationId={organizationId} />;
    case 'integrations': return <IntegrationsScreen key={key} organizationId={organizationId} />;
    case 'audit': return <AuditCenter key={key} organizationId={organizationId} />;
    case 'billing': return <BillingScreen key={key} organizationId={organizationId} />;
    case 'settings': return <OrgSettingsScreen key={key} organizationId={organizationId} />;
  }
}
