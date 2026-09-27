import { useState } from 'react';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { newId } from '@/features/admin/contentDocument';
import { getText } from './inspectorText';
import type { AnyComponent } from './inspectorText';

export function TableFields({ component, sectionId }: { component: AnyComponent; sectionId: string }) {
  const { updateComponentProps } = useViewsEditor();
  const { locale, t } = useI18n();
  const [rowsError, setRowsError] = useState<string | null>(null);

  const columns = (component.props.columns as Array<{ key: string; label: unknown }> | undefined) ?? [];
  const columnLines = columns.map((col) => `${col.key}, ${getText(col.label, locale)}`).join('\n');
  const rowsText = JSON.stringify(component.props.rows ?? [], null, 2);

  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium text-text-secondary">
        {t('views.table.columns')}
        <textarea
          defaultValue={columnLines}
          rows={3}
          onBlur={(e) => {
            const next = e.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [key, ...rest] = line.split(',');
                const label = rest.join(',').trim() || key.trim();
                const current = columns.find((col) => col.key === key.trim());
                return {
                  key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '') || `col_${newId().slice(0, 4)}`,
                  label: { ...((current?.label as Record<string, string> | undefined) ?? {}), [locale]: label },
                };
              });
            updateComponentProps(sectionId, component.id, { columns: next });
          }}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
        />
        <span className="mt-1 block text-[11px] font-normal text-text-muted">{t('views.table.columnsHint')}</span>
      </label>
      <label className="block text-xs font-medium text-text-secondary">
        {t('views.table.rows')}
        <textarea
          defaultValue={rowsText}
          rows={4}
          onBlur={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              updateComponentProps(sectionId, component.id, { rows: [] });
              setRowsError(null);
              return;
            }
            try {
              const parsed: unknown = JSON.parse(raw);
              if (!Array.isArray(parsed)) throw new Error('not-array');
              updateComponentProps(sectionId, component.id, { rows: parsed });
              setRowsError(null);
            } catch {
              setRowsError(t('views.table.invalidRows'));
            }
          }}
          className="mt-1 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
        />
        <span className="mt-1 block text-[11px] font-normal text-text-muted">{t('views.table.rowsHint')}</span>
        {rowsError && <span className="mt-1 block text-[11px] text-red-500">{rowsError}</span>}
      </label>
    </div>
  );
}
