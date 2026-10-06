import { useEffect, useState } from 'react';
import { CircleNotch } from '@phosphor-icons/react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { getPanelAudience, type TaxonomyPanel } from '@/lib/northAdmin';

/** Fase 4 (settings): audiencia real de lectura; escritura sigue fail-closed. */
export function ViewsSettingsTab() {
  const { organizationId, selection, activePanel } = useViewsEditor();
  const { locale, t } = useI18n();
  const [audience, setAudience] = useState<TaxonomyPanel['audienceType']>('ALL_MEMBERS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  useEffect(() => {
    if (!selection.panelId) return;
    setLoading(true);
    setError(null);
    getPanelAudience(organizationId, selection.panelId)
      .then((res) => setAudience(res.type))
      .catch((err) => setError(err instanceof Error ? err.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [organizationId, selection.panelId]);

  if (!activePanel) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-sm font-semibold text-text">{localName(activePanel.name)}</h2>
        <div>
          <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
            {t('views.audience.title')}
          </span>
          {loading ? (
            <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
              <CircleNotch className="h-3.5 w-3.5 animate-spin" />
              {t('admin.loading')}
            </div>
          ) : (
            <select
              value={audience}
              disabled
              title={t('views.audience.readonlyNote')}
              className="mt-2 h-9 w-full rounded-md border border-border bg-background px-2 text-sm opacity-70"
            >
              <option value="ALL_MEMBERS">{t('views.audience.all')}</option>
              <option value="ROLES">{t('views.audience.roles')}</option>
              <option value="GROUPS">{t('views.audience.groups')}</option>
              <option value="PERMISSIONS">PERMISSIONS</option>
              <option value="SPECIFIC_USERS">SPECIFIC_USERS</option>
            </select>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">{t('views.audience.readonlyNote')}</p>
        </div>
      </div>
    </div>
  );
}
