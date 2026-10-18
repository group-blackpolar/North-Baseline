import { Warning } from '@phosphor-icons/react';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { useResource } from '@/features/admin-center/hooks';
import { Loading, Notice } from '@/features/admin-center/ui';
import { groupFields } from './pipelineApi';
import type { GroupDetail } from './groupsApi';

/** Real signals only: import health from CORECROW and the schema drift between the group's periods (missing columns, type conflicts). */
export function QualityPanel({ organizationId, group }: { organizationId: string; group: GroupDetail }) {
  const { t } = useI18n();
  const fields = useResource(() => groupFields(organizationId, group.id), [organizationId, group.id]);
  if (fields.status === 'loading') return <Loading />;
  if (fields.status !== 'ready' || !fields.data) return <Notice error={fields.error} />;
  const drift = fields.data.fields.filter((field) => field.missingIn.length > 0 || field.typeConflict);
  return (
    <div className="space-y-4">
      <p className="flex items-center gap-2 text-xs">
        <Status tone={group.summary.health === 'ISSUES' ? 'error' : group.summary.health === 'OK' ? 'active' : 'neutral'}>{t(`dg.health.${group.summary.health}`)}</Status>
        {group.summary.datasetsWithIssues > 0 ? <span className="text-error">{t('dg.q.failing', { count: group.summary.datasetsWithIssues })}</span> : null}
      </p>
      <section className="space-y-1.5">
        <h3 className="ui-label">{t('dg.q.drift')}</h3>
        {drift.length === 0 ? <p className="text-xs text-success">{t('dg.q.noDrift')}</p> : (
          <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
            {drift.map((field) => (
              <li key={field.key} className="space-y-0.5 px-3 py-2">
                <p className="flex items-center gap-1.5 font-medium"><Warning className="size-3.5 text-warning" />{field.key}<span className="mono-data font-normal text-text-muted">{field.types.join(' / ')}</span></p>
                {field.typeConflict ? <p className="text-error">{t('dg.q.typeConflict')}</p> : null}
                {field.missingIn.length ? <p className="text-text-secondary">{t('dg.q.missingIn', { list: field.missingIn.join(', ') })}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-text-muted">{t('dg.q.driftNote')}</p>
      </section>
    </div>
  );
}
