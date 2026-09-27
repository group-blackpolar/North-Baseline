import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const getText = (value: unknown, locale: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const entry = record[locale] ?? record.es ?? record.en ?? Object.values(record)[0];
  return typeof entry === 'string' ? entry : '';
};

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

      {['image', 'video', 'file', 'embed'].includes(component.type) && (
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
