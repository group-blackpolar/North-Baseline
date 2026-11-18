import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { ApiError } from '@/lib/api';
import { getLanding, isLandingDraftValid, moveRule, saveLanding, type LandingMode, type LandingPolicy, type LandingRule } from '@/lib/landing';
import { listAuthorizedTaxonomy, listPermissionSubjects } from '@/lib/northAdmin';
import { flattenTree, localName, type TreeCategory } from '@/features/views/workspace/resources';
import { useResource } from './hooks';
import { Loading, Notice, errorText, invalidateOrganization, selectClass } from './ui';

const MODES: LandingMode[] = ['STANDARD', 'PANEL', 'NONE'];

/** Landing policy of an organization (ADR 027): mode, default view and ordered role/group rules. CORECROW validates and resolves. */
export function LandingEditor({ organizationId, editable }: { organizationId: string; editable: boolean }) {
  const { t, locale } = useI18n();
  const { push } = useNotifications();
  const stored = useResource(() => getLanding(organizationId), [organizationId]);
  const tree = useResource(() => listAuthorizedTaxonomy(organizationId), [organizationId]);
  const subjects = useResource(() => listPermissionSubjects(organizationId), [organizationId]);
  const [draft, setDraft] = useState<LandingPolicy | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (stored.data) setDraft(stored.data); }, [stored.data]);

  const panels = useMemo(
    () => flattenTree((tree.data ?? []) as unknown as TreeCategory[]).filter((resource) => resource.kind === 'PANEL' && resource.status === 'PUBLISHED' && resource.resourceKind === 'CONTENT'),
    [tree.data],
  );
  if (stored.status === 'loading' || tree.status === 'loading') return <Loading />;
  if (!draft) return stored.status === 'forbidden' ? null : <Notice error={stored.error} />;

  const panelLabel = (panel: (typeof panels)[number]) => `${localName(panel.categoryName, locale)} / ${localName(panel.name, locale)}`;
  const panelSelect = (value: string, onChange: (value: string) => void, label: string) => (
    <select aria-label={label} className={`${selectClass} w-full min-w-0`} disabled={!editable || busy} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t('adm2.landing.selectPanel')}</option>
      {panels.map((panel) => <option key={panel.id} value={panel.id}>{panelLabel(panel)}</option>)}
    </select>
  );
  const patch = (next: Partial<LandingPolicy>) => setDraft({ ...draft, ...next });
  const setRule = (index: number, next: Partial<LandingRule>) => patch({ rules: draft.rules.map((rule, i) => (i === index ? { ...rule, ...next } : rule)) });
  const valid = isLandingDraftValid(draft);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const saved = await saveLanding(organizationId, draft);
      setDraft(saved);
      invalidateOrganization(organizationId);
      push({ type: 'success', title: t('adm.settings.saved') });
    } catch (reason) {
      setError(reason instanceof ApiError && reason.code === 'LANDING_CONFLICT' ? t('adm2.landing.conflict') : errorText(reason));
    } finally { setBusy(false); }
  };

  return (
    <DashboardCard title={t('adm2.settings.prefs.home')} description={editable ? t('adm2.settings.prefs.homeHint') : t('access.readOnly')}>
      <div className="space-y-4">
        <fieldset className="space-y-2" disabled={!editable || busy}>
          <legend className="ui-label pb-1">{t('adm2.landing.mode')}</legend>
          {MODES.map((mode) => (
            <label key={mode} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border p-2.5 text-sm has-[:checked]:border-accent">
              <input type="radio" name="landing-mode" className="mt-0.5" checked={draft.mode === mode} onChange={() => patch({ mode, defaultPanelId: mode === 'PANEL' ? draft.defaultPanelId : null })} />
              <span><span className="block font-medium text-text">{t(`adm2.landing.mode.${mode}`)}</span><span className="block text-xs text-text-muted">{t(`adm2.landing.mode.${mode}.hint`)}</span></span>
            </label>
          ))}
        </fieldset>

        {draft.mode === 'PANEL' ? (
          <div className="space-y-1.5">
            <span className="ui-label">{t('adm2.landing.default')}</span>
            {panelSelect(draft.defaultPanelId ?? '', (value) => patch({ defaultPanelId: value || null }), t('adm2.landing.default'))}
          </div>
        ) : null}

        {draft.mode !== 'NONE' ? (
          <div className="space-y-2">
            <div>
              <span className="ui-label">{t('adm2.landing.rules')}</span>
              <p className="text-xs text-text-muted">{t('adm2.landing.rulesHint')}</p>
            </div>
            {draft.rules.length === 0 ? <p className="text-xs text-text-muted">{t('adm2.landing.noRules')}</p> : null}
            <ol className="space-y-2">
              {draft.rules.map((rule, index) => (
                <li key={index} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                  <span className="w-5 text-center text-xs text-text-muted">{index + 1}</span>
                  {rule.role !== undefined ? (
                    <select aria-label={t('adm2.landing.role')} className={`${selectClass} w-40`} disabled={!editable || busy} value={rule.role} onChange={(event) => setRule(index, { role: event.target.value })}>
                      <option value="">{t('adm2.landing.pick')}</option>
                      {(subjects.data?.roles ?? []).map((role) => <option key={role} value={role}>{role}</option>)}
                    </select>
                  ) : (
                    <select aria-label={t('adm2.landing.group')} className={`${selectClass} w-40`} disabled={!editable || busy} value={rule.groupId ?? ''} onChange={(event) => setRule(index, { groupId: event.target.value })}>
                      <option value="">{t('adm2.landing.pick')}</option>
                      {(subjects.data?.groups ?? []).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                    </select>
                  )}
                  <div className="min-w-48 flex-1">{panelSelect(rule.panelId, (value) => setRule(index, { panelId: value }), t('adm2.landing.default'))}</div>
                  {editable ? (
                    <div className="flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={t('adm2.landing.up')} disabled={busy || index === 0} onClick={() => patch({ rules: moveRule(draft.rules, index, -1) })}><ArrowUp className="size-4" /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('adm2.landing.down')} disabled={busy || index === draft.rules.length - 1} onClick={() => patch({ rules: moveRule(draft.rules, index, 1) })}><ArrowDown className="size-4" /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label={t('adm2.landing.remove')} disabled={busy} onClick={() => patch({ rules: draft.rules.filter((_, i) => i !== index) })}><Trash className="size-4" /></Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ol>
            {editable ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => patch({ rules: [...draft.rules, { role: '', panelId: '' }] })}><Plus className="size-4" />{t('adm2.landing.addRole')}</Button>
                <Button size="sm" disabled={busy} onClick={() => patch({ rules: [...draft.rules, { groupId: '', panelId: '' }] })}><Plus className="size-4" />{t('adm2.landing.addGroup')}</Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="accent" loading={busy} disabled={!valid} onClick={() => void save()}>{t('adm2.landing.save')}</Button>
            {!valid ? <span className="text-xs text-text-muted">{t('adm2.landing.invalid')}</span> : null}
          </div>
        ) : null}
        <Notice error={error} />
      </div>
    </DashboardCard>
  );
}
