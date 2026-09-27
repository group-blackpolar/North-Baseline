import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { docToLines, linesToDoc } from './inspectorText';
import type { AnyComponent } from './inspectorText';

export function RichTextFields({
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
  const initial = docToLines(component.props.documents, locale);

  return (
    <label className="block text-xs font-medium text-text-secondary">
      {t('views.richText.text')}
      <textarea
        defaultValue={initial}
        rows={4}
        onChange={(e) => {
          const next = linesToDoc(e.target.value, (component.props.documents as Record<string, unknown> | undefined)?.[locale]);
          const documents = {
            ...((component.props.documents as Record<string, unknown> | undefined) ?? {}),
            [locale]: next,
          };
          updateComponentProps(sectionId, component.id, { documents });
        }}
        className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm"
      />
      <span className="mt-1 block text-[11px] font-normal text-text-muted">{t('views.richText.hint')}</span>
    </label>
  );
}
