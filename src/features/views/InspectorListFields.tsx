import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { newId } from '@/features/admin/contentDocument';
import { getText } from './inspectorText';
import type { AnyComponent } from './inspectorText';

export function ListFields({
  component,
  sectionId,
  locale,
}: {
  component: AnyComponent;
  sectionId: string;
  locale: string;
}) {
  const { updateComponentProps } = useViewsEditor();
  const { t } = useI18n();
  const items = (component.props.items as Array<{ id: string; text: unknown }> | undefined) ?? [];
  const initial = items.map((item) => getText(item.text, locale)).join('\n');

  return (
    <label className="block text-xs font-medium text-text-secondary">
      {t('views.list.items')}
      <textarea
        defaultValue={initial}
        rows={4}
        onBlur={(e) => {
          const next = e.target.value
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => ({ id: newId(), text: { [locale]: line } }));
          updateComponentProps(sectionId, component.id, { items: next });
        }}
        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
      />
    </label>
  );
}
