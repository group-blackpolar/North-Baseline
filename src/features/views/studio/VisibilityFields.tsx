import { useI18n } from '@/lib/i18n';
import { listPermissionSubjects } from '@/lib/northAdmin';
import { useResource } from '@/features/admin-center/hooks';
import { useViewsEditor } from '../ViewsEditorContext';
import { ToggleField } from './fields';
import { setComponentVisibility, type Component } from './documentOps';

type Selection = { roles: string[]; groupIds: string[] };

/** ADR 027 D3: who receives this block once published. Enforced by CORECROW on every published document; the draft always shows it. */
export function VisibilityFields({ component }: { component: Component }) {
  const { t } = useI18n();
  const { organizationId, edit } = useViewsEditor();
  const subjects = useResource(() => listPermissionSubjects(organizationId), [organizationId]);
  const visibility = component.visibility;
  const roles = visibility?.roles ?? [];
  const groupIds = visibility?.groupIds ?? [];
  const set = (next: Selection | undefined) => edit((doc) => setComponentVisibility(doc, component.id, next), { key: `visibility:${component.id}` });
  // An empty restriction is rejected by CORECROW, so switching it on (or emptying it) falls back to the most restrictive role.
  const toggle = (on: boolean) => set(on ? { roles: ['OWNER'], groupIds: [] } : undefined);
  const change = (next: Selection) => set(next.roles.length + next.groupIds.length ? next : { roles: ['OWNER'], groupIds: [] });
  const flip = (list: string[], value: string) => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

  return (
    <div className="space-y-2">
      <ToggleField label={t('st.vis.restrict')} checked={Boolean(visibility)} onChange={toggle} help={t('st.vis.help')} />
      {visibility ? (
        <div className="space-y-2 rounded-lg border border-border p-2.5">
          <fieldset className="space-y-1">
            <legend className="text-[11px] font-semibold text-text-secondary">{t('st.vis.roles')}</legend>
            {(subjects.data?.roles ?? ['OWNER', 'ADMIN', 'BILLING_ADMIN', 'MEMBER', 'VIEWER']).map((role) => (
              <label key={role} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={roles.includes(role)} onChange={() => change({ roles: flip(roles, role), groupIds })} />{role}</label>
            ))}
          </fieldset>
          {(subjects.data?.groups.length ?? 0) > 0 ? (
            <fieldset className="space-y-1">
              <legend className="text-[11px] font-semibold text-text-secondary">{t('st.vis.groups')}</legend>
              {subjects.data!.groups.map((group) => (
                <label key={group.id} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={groupIds.includes(group.id)} onChange={() => change({ roles, groupIds: flip(groupIds, group.id) })} />{group.name}</label>
              ))}
            </fieldset>
          ) : null}
          <p className="text-[11px] leading-4 text-text-muted">{t('st.vis.note')}</p>
        </div>
      ) : null}
    </div>
  );
}
