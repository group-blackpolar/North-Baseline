import { useState } from 'react';
import { Eye } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { useNotifications } from '@/context/NotificationContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useI18n } from '@/lib/i18n';
import { setInspection, type InspectedOrganization } from '@/lib/inspection';
import { endOrganizationInspection } from '@/lib/platformAdmin';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { pushPath } from '@/lib/routes';

/** Always visible while a platform operator is reading an organization through privileged, read-only inspection. */
export function InspectionBanner({ organization }: { organization: InspectedOrganization }) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const { switchOrganization } = useOrganization();
  const [busy, setBusy] = useState(false);

  const exit = async () => {
    setBusy(true);
    try { await endOrganizationInspection(organization.id, organization.inspectionSessionId); }
    catch (reason) { push({ type: 'error', title: reason instanceof Error ? reason.message : t('adm.inspect.failed') }); }
    finally {
      // Leaving is always local-first: the privileged header stops being sent even if the audit call failed.
      setInspection(null);
      switchOrganization(PERSONAL_ORG_ID);
      pushPath('/workspace/admin/organizations');
      setBusy(false);
    }
  };

  return (
    <div role="status" className="flex shrink-0 items-center gap-3 border-b border-warning/40 bg-warning/10 px-3 py-1.5 text-xs text-text">
      <Eye className="size-4 shrink-0 text-warning" weight="bold" />
      <OrganizationAvatar name={organization.name} iconData={organization.iconData} className="size-5 rounded-md text-[10px]" />
      <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{t('adm.inspect.banner')}</span> · {organization.name} · <span className="text-text-secondary">{t('adm.inspect.readOnly')}</span></span>
      <Button size="sm" variant="outline" loading={busy} onClick={() => void exit()}>{t('adm.inspect.exit')}</Button>
    </div>
  );
}
