import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getText } from './inspectorText';
import { RichTextFields } from './InspectorRichTextFields';
import { TableFields } from './InspectorTableFields';
import { ListFields } from './InspectorListFields';

export function InspectorComponentForm() {
  const { selection, activeDocument, updateComponentProps, touchDocument } = useViewsEditor();
  const { locale, t } = useI18n();

  const section = activeDocument?.sections.find((item) => item.id === selection.sectionId);
  const component = section?.components.find((item) => item.id === selection.componentId);
  if (!section || !component) return null;

  const setLocalizedProp = (key: string, value: string) => {
    const current = (component.props[key] as Record<string, string> | undefined) ?? {};
    updateComponentProps(section.id, component.id, { [key]: { ...current, [locale]: value } });
  };

  const setProp = (key: string, value: unknown) => {
    updateComponentProps(section.id, component.id, { [key]: value });
  };

  const updateSectionGap = (gap: 'none' | 'sm' | 'md' | 'lg') => {
    touchDocument((doc) => ({
      ...doc,
      sections: doc.sections.map((item) =>
        item.id === section.id ? { ...item, layout: { ...item.layout, gap } } : item,
      ),
    }));
  };

  return (
    <div className="space-y-4">
      <div>
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          {t('views.inspector.section')} #{section.order + 1} · {component.type}
        </span>
      </div>

      {(component.type === 'heading' || component.type === 'card') && (
        <label className="block text-xs font-medium text-text-secondary">
          {t('views.props.title')}
          <Input
            value={getText(component.type === 'heading' ? component.props.text : component.props.title, locale)}
            onChange={(e) =>
              setLocalizedProp(component.type === 'heading' ? 'text' : 'title', e.target.value)
            }
            className="mt-1"
          />
        </label>
      )}

      {component.type === 'metric' && (
        <>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.label')}
            <Input
              value={getText(component.props.label, locale)}
              onChange={(e) => setLocalizedProp('label', e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.value')}
            <Input
              value={String(component.props.value ?? '')}
              onChange={(e) => setProp('value', e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.format')}
            <select
              value={String(component.props.format ?? 'number')}
              onChange={(e) => setProp('format', e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="number">number</option>
              <option value="percentage">percentage</option>
              <option value="currency">currency</option>
            </select>
          </label>
        </>
      )}

      {component.type === 'link' && (
        <>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.text')}
            <Input
              value={getText(component.props.label, locale)}
              onChange={(e) => setLocalizedProp('label', e.target.value)}
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.href')}
            <Input
              value={String(component.props.href ?? '')}
              onChange={(e) => setProp('href', e.target.value)}
              placeholder="https://"
              className="mt-1"
            />
          </label>
        </>
      )}

      {component.type === 'divider' && (
        <label className="block text-xs font-medium text-text-secondary">
          {t('views.props.variant')}
          <select
            value={String(component.props.variant ?? 'solid')}
            onChange={(e) => setProp('variant', e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="solid">solid</option>
            <option value="dashed">dashed</option>
          </select>
        </label>
      )}

      {component.type === 'heading' && (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.level')}
            <select
              value={String(component.props.level ?? 2)}
              onChange={(e) => setProp('level', Number(e.target.value))}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.props.align')}
            <select
              value={String(component.props.align ?? 'left')}
              onChange={(e) => setProp('align', e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </label>
        </div>
      )}

      {component.type === 'rich_text' && (
        <RichTextFields component={component} sectionId={section.id} locale={locale} />
      )}

      {component.type === 'table' && <TableFields component={component} sectionId={section.id} />}

      {component.type === 'list' && <ListFields component={component} sectionId={section.id} locale={locale} />}

      {component.type === 'embed' && (
        <>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.embed.url')}
            <Input
              value={String(component.props.url ?? '')}
              onChange={(e) => setProp('url', e.target.value)}
              placeholder="https://"
              className="mt-1"
            />
          </label>
          <label className="block text-xs font-medium text-text-secondary">
            {t('views.embed.title')}
            <Input
              value={getText(component.props.title, locale)}
              onChange={(e) => setLocalizedProp('title', e.target.value)}
              className="mt-1"
            />
          </label>
        </>
      )}

      {['image', 'video', 'file'].includes(component.type) && (
        <p className="rounded-lg bg-surface-hover/60 p-3 text-[11px] leading-relaxed text-text-muted">
          {t('views.props.assetNote')}
        </p>
      )}

      <div className="border-t border-border pt-3">
        <span className="text-[11px] font-medium text-text-muted uppercase tracking-wider">
          {t('views.section.gap')}
        </span>
        <div className="mt-2 flex gap-1">
          {(['none', 'sm', 'md', 'lg'] as const).map((gap) => (
            <Button
              key={gap}
              type="button"
              variant={section.layout.gap === gap ? 'accent' : 'outline'}
              size="sm"
              onClick={() => updateSectionGap(gap)}
              className="h-7 flex-1 text-[11px]"
            >
              {gap}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
