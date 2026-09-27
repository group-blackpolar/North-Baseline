import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Sliders } from 'lucide-react';

export function ViewsInspectorPane() {
  const { selection, activePanel } = useViewsEditor();
  const { locale, t } = useI18n();

  const localName = (nameObj?: Record<string, string>) =>
    nameObj ? nameObj[locale] ?? nameObj.es ?? nameObj.en ?? Object.values(nameObj)[0] ?? '' : '';

  return (
    <aside className="w-80 shrink-0 border-l border-border bg-surface flex flex-col h-full select-none">
      <div className="flex items-center gap-2 p-3.5 border-b border-border">
        <Sliders className="w-4 h-4 text-accent" />
        <span className="text-xs font-semibold text-text uppercase tracking-wider">{t('views.inspector.title')}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activePanel ? (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t('views.nameLabel')}</label>
              <div className="mt-1 text-sm font-medium text-text">{localName(activePanel.name)}</div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t('views.slugLabel')}</label>
              <div className="mt-1 font-mono text-xs text-text-secondary bg-surface-hover/70 px-2 py-1 rounded">
                /{activePanel.slug}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Estado</label>
              <div className="mt-1">
                <span
                  className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${
                    activePanel.status === 'PUBLISHED'
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : activePanel.status === 'DRAFT'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-surface-hover text-text-muted line-through'
                  }`}
                >
                  {activePanel.status}
                </span>
              </div>
            </div>

            <div className="border-t border-border pt-3">
              <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">{t('views.audience.title')}</label>
              <div className="mt-1 text-xs text-text-secondary">
                {activePanel.audienceType === 'ALL_MEMBERS'
                  ? t('views.audience.all')
                  : activePanel.audienceType === 'ROLES'
                  ? t('views.audience.roles')
                  : t('views.audience.groups')}
              </div>
            </div>

            {selection.componentId && (
              <div className="border-t border-border pt-3">
                <label className="text-[11px] font-medium text-text-muted uppercase tracking-wider">Bloque seleccionado</label>
                <div className="mt-1 text-xs font-mono text-accent">ID: {selection.componentId.slice(0, 8)}…</div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-xs text-text-muted">
            {t('views.inspector.noSelection')}
          </div>
        )}
      </div>
    </aside>
  );
}
