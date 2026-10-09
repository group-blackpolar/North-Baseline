import { useState } from 'react';
import { Copy, CursorClick, Plus, Trash, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RichTextFields } from '../InspectorRichTextFields';
import { ListFields } from '../InspectorListFields';
import { TableFields } from '../InspectorTableFields';
import { DataTab } from './DataTab';
import { findComponent, setComponentBinding, setComponentCell, setComponentProps, removeComponent, duplicateComponent, removeSection, duplicateSection, setSectionLayout, setSectionName, type Component } from './documentOps';
import { ColorField, Group, NumberField, SegmentedField, SelectField, SliderField, TextField, ToggleField } from './fields';
import { ANALYTICS_TYPES, DATA_BINDING_KEY, definitionOf } from './registry';
import { AnalyticsFields, SlotBindings, useSlotColumns } from './AnalyticsInspector';
import { componentLabelKey } from './labels';
import type { DraftIssue, PanelBinding } from './studioApi';
import { useViewsEditor } from '../ViewsEditorContext';

type Tab = 'general' | 'appearance' | 'data' | 'advanced';
const VARIANTS = ['default', 'primary', 'secondary', 'muted', 'success', 'warning', 'danger'] as const;
const text = (value: unknown, locale: string): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const entry = record[locale] ?? record.es ?? record.en ?? Object.values(record)[0];
  return typeof entry === 'string' ? entry : '';
};
const isHttpOrMail = (value: string) => { try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol); } catch { return false; } };

export function StudioInspector({ panelId, bindings, onBindingsChanged, issues, onOpenLibrary }: {
  panelId: string;
  bindings: ReadonlyArray<PanelBinding>;
  onBindingsChanged: () => Promise<void>;
  issues: ReadonlyArray<DraftIssue>;
  onOpenLibrary: (sectionId: string | null) => void;
}) {
  const { t } = useI18n();
  const { selection, activeDocument, organizationId, setModal } = useViewsEditor();
  const [tab, setTab] = useState<Tab>('general');
  const found = activeDocument && selection.componentId ? findComponent(activeDocument, selection.componentId) : null;
  const section = activeDocument?.sections.find((item) => item.id === selection.sectionId);

  if (found) {
    const definition = definitionOf(found.component.type);
    const tabs: Array<{ id: Tab; label: string; hidden?: boolean }> = [
      { id: 'general', label: t('st.tab.general') },
      { id: 'appearance', label: t('st.tab.appearance'), hidden: !definition || definition.appearance.length === 0 },
      { id: 'data', label: t('st.tab.data'), hidden: !definition || definition.binding === 'none' },
      { id: 'advanced', label: t('st.tab.advanced') },
    ];
    const visible = tabs.filter((item) => !item.hidden);
    const current = visible.some((item) => item.id === tab) ? tab : 'general';
    const mine = issues.filter((issue) => issue.componentId === found.component.id);
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border px-3 pb-0 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate font-display text-sm font-semibold text-text">{t(componentLabelKey(found.component.type))}</h2>
            {mine.some((issue) => issue.severity === 'error') ? <WarningCircle className="size-4 shrink-0 text-error" aria-label={t('st.inspector.hasIssues')} /> : null}
          </div>
          <div role="tablist" aria-label={t('st.inspector.title')} className="-mb-px mt-2 flex gap-0.5 overflow-x-auto">
            {visible.map((item) => (
              <button
                key={item.id}
                id={`insp-tab-${item.id}`}
                role="tab"
                type="button"
                aria-selected={current === item.id}
                aria-controls="insp-panel"
                onClick={() => setTab(item.id)}
                className={cn('shrink-0 rounded-t-md border-b-2 px-2 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40', current === item.id ? 'border-accent text-text' : 'border-transparent text-text-muted hover:text-text')}
              >{item.label}</button>
            ))}
          </div>
        </div>
        <div id="insp-panel" role="tabpanel" aria-labelledby={`insp-tab-${current}`} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3" key={`${found.component.id}:${current}`}>
          {mine.length > 0 ? (
            <ul className="space-y-1 rounded-lg border border-border bg-surface-hover/50 p-2">
              {mine.map((issue, index) => <li key={index} className={cn('flex items-start gap-1.5 text-[11px] leading-4', issue.severity === 'error' ? 'text-error' : 'text-warning')}><WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{issue.message}</li>)}
            </ul>
          ) : null}
          {current === 'general' ? <GeneralTab component={found.component} sectionId={found.section.id} bindings={bindings} /> : null}
          {current === 'appearance' ? <AppearanceTab component={found.component} /> : null}
          {current === 'data' ? <DataTabHost panelId={panelId} organizationId={organizationId} component={found.component} bindings={bindings} onBindingsChanged={onBindingsChanged} /> : null}
          {current === 'advanced' ? <AdvancedTab component={found.component} /> : null}
        </div>
      </div>
    );
  }

  if (section) return <SectionPanel sectionId={section.id} onOpenLibrary={onOpenLibrary} />;
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
      <CursorClick className="size-8 text-text-muted" weight="duotone" aria-hidden="true" />
      <p className="text-sm font-medium text-text">{t('st.inspector.emptyTitle')}</p>
      <p className="max-w-56 text-xs leading-5 text-text-muted">{t('st.inspector.emptyBody')}</p>
      <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'dev_json' })}>{t('st.inspector.json')}</Button>
    </div>
  );
}

function SectionPanel({ sectionId, onOpenLibrary }: { sectionId: string; onOpenLibrary: (sectionId: string | null) => void }) {
  const { t, locale } = useI18n();
  const { activeDocument, edit, commit, getDocument, selectSection } = useViewsEditor();
  const section = activeDocument?.sections.find((item) => item.id === sectionId);
  if (!section) return null;
  return (
    <div className="space-y-4 p-3">
      <h2 className="font-display text-sm font-semibold text-text">{t('st.section.title')}</h2>
      <TextField label={t('st.section.name')} value={section.name?.[locale] ?? ''} onChange={(value) => edit((doc) => setSectionName(doc, sectionId, locale, value), { key: `section-name:${sectionId}` })} maxLength={120} />
      <SegmentedField label={t('st.section.spacing')} value={section.layout.gap} options={(['none', 'sm', 'md', 'lg'] as const).map((gap) => ({ value: gap, label: gap === 'none' ? '0' : gap.toUpperCase() }))} onChange={(gap) => edit((doc) => setSectionLayout(doc, sectionId, { gap }))} />
      <p className="text-[11px] leading-4 text-text-muted">{t('st.section.count', { n: section.components.length })}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onOpenLibrary(sectionId)}><Plus aria-hidden="true" />{t('st.section.addComponent')}</Button>
        <Button size="sm" variant="outline" onClick={() => { const doc = getDocument(); const next = doc ? duplicateSection(doc, sectionId) : null; if (next) { commit(next.doc); selectSection(next.sectionId); } }}><Copy aria-hidden="true" />{t('st.section.duplicate')}</Button>
        <Button size="sm" variant="outline" className="text-error" onClick={() => edit((doc) => removeSection(doc, sectionId))}><Trash aria-hidden="true" />{t('st.section.remove')}</Button>
      </div>
    </div>
  );
}

function GeneralTab({ component, sectionId, bindings }: { component: Component; sectionId: string; bindings: ReadonlyArray<PanelBinding> }) {
  const { t, locale } = useI18n();
  const { updateComponentProps, edit, device, epoch, organizationId } = useViewsEditor();
  const columnsBySlot = useSlotColumns(organizationId, component, bindings);
  const analytics = ANALYTICS_TYPES.has(component.type) || component.type === 'filter_bar';
  const set = (patch: Record<string, unknown>) => updateComponentProps(sectionId, component.id, patch);
  const setLocalized = (key: string, value: string) => {
    const current = { ...((component.props[key] as Record<string, string> | undefined) ?? {}) };
    if (value.trim()) current[locale] = value; else delete current[locale];
    set({ [key]: current });
  };
  const localizedField = (key: string, label: string, max = 500) => <TextField label={label} value={text(component.props[key], locale)} onChange={(value) => setLocalized(key, value)} maxLength={max} />;
  const cell = component.layout[device];
  const place = (patch: Partial<typeof cell>) => edit((doc) => setComponentCell(doc, component.id, device, { ...cell, ...patch }), { key: `cell:${component.id}:${device}` });
  const href = String(component.props.href ?? '');
  const embedUrl = String(component.props.url ?? '');
  return (
    <>
      {analytics ? <AnalyticsFields component={component} columnsBySlot={columnsBySlot} /> : null}
      {analytics ? null : <Group title={t('st.group.content')}>
        {component.type === 'heading' ? localizedField('text', t('st.prop.text')) : null}
        {component.type === 'card' ? <>{localizedField('title', t('st.prop.title'))}{localizedField('body', t('st.prop.body'), 2000)}</> : null}
        {component.type === 'link' ? (
          <>
            {localizedField('label', t('st.prop.label'))}
            <TextField label={t('st.prop.href')} value={href} onChange={(value) => set({ href: value })} placeholder="https://" mono />
            {href && !isHttpOrMail(href) ? <p role="alert" className="text-[11px] text-error">{t('st.prop.hrefInvalid')}</p> : null}
          </>
        ) : null}
        {component.type === 'metric' ? (
          <>
            {localizedField('label', t('st.prop.label'))}
            <TextField label={t('st.prop.staticValue')} value={String(component.props.value ?? '')} onChange={(value) => set({ value: value || undefined })} maxLength={500} help={t('st.prop.staticValueHelp')} />
            <SelectField label={t('st.prop.format')} value={String(component.props.format ?? 'number')} options={(['number', 'currency', 'percent', 'duration', 'text'] as const).map((value) => ({ value, label: t(`st.format.${value}` as 'st.format.number') }))} onChange={(value) => set({ format: value })} />
          </>
        ) : null}
        {component.type === 'bar_chart' || component.type === 'line_chart' || component.type === 'donut_chart' ? localizedField('title', t('st.prop.title')) : null}
        {component.type === 'embed' ? (
          <>
            <TextField label={t('st.prop.embedUrl')} value={embedUrl} onChange={(value) => set({ url: value })} placeholder="https://" mono help={t('st.prop.embedHelp')} />
            {localizedField('title', t('st.prop.title'))}
          </>
        ) : null}
        {component.type === 'rich_text' ? <RichTextFields key={`${component.id}:${epoch}`} component={component} sectionId={sectionId} locale={locale} /> : null}
        {component.type === 'list' ? <ListFields key={`${component.id}:${epoch}`} component={component} sectionId={sectionId} locale={locale} /> : null}
        {component.type === 'table' ? <TableFields key={`${component.id}:${epoch}`} component={component} sectionId={sectionId} /> : null}
        {['divider'].includes(component.type) ? <p className="text-xs text-text-muted">{t('st.prop.noContent')}</p> : null}
        {['image', 'video', 'file', 'document_workspace'].includes(component.type) ? <p className="rounded-lg bg-surface-hover/60 p-3 text-[11px] leading-4 text-text-muted">{t('views.props.assetNote')}</p> : null}
      </Group>}
      <Group title={t('st.group.position', { device: t(`st.device.${device}` as 'st.device.desktop') })}>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t('st.layout.x')} value={cell.x + 1} min={1} max={12} onChange={(value) => place({ x: value - 1 })} />
          <NumberField label={t('st.layout.y')} value={cell.y + 1} min={1} max={10000} onChange={(value) => place({ y: value - 1 })} />
          <NumberField label={t('st.layout.w')} value={cell.w} min={1} max={12} suffix={t('st.layout.cols')} onChange={(value) => place({ w: value })} />
          <NumberField label={t('st.layout.h')} value={cell.h} min={1} max={100} suffix={t('st.layout.rows')} onChange={(value) => place({ h: value })} />
        </div>
        {device !== 'desktop' ? (
          <Button size="sm" variant="ghost" onClick={() => edit((doc) => { const current = findComponent(doc, component.id); return current ? setComponentCell(doc, component.id, device, current.component.layout.desktop) : doc; })}>{t('st.layout.copyDesktop')}</Button>
        ) : null}
        <p className="text-[11px] leading-4 text-text-muted">{t('st.layout.perDevice')}</p>
      </Group>
    </>
  );
}

function AppearanceTab({ component }: { component: Component }) {
  const { t } = useI18n();
  const { updateComponentProps } = useViewsEditor();
  const definition = definitionOf(component.type);
  const has = (key: NonNullable<typeof definition>['appearance'][number]) => Boolean(definition?.appearance.includes(key));
  const props = component.props;
  const set = (patch: Record<string, unknown>) => updateComponentProps('', component.id, patch);
  const series = (Array.isArray(props.series) ? props.series : []) as Array<{ key: string; label: Record<string, string>; color?: string }>;
  const setSeriesColor = (key: string, color: string | undefined) => set({ series: series.map((item) => { if (item.key !== key) return item; const { color: _old, ...rest } = item; return color ? { ...rest, color } : rest; }) });
  return (
    <>
      <Group title={t('st.group.style')}>
        {has('variant') && component.type !== 'divider' ? <SelectField label={t('st.prop.variant')} value={String(props.variant ?? 'default')} options={VARIANTS.map((value) => ({ value, label: t(`st.variant.${value}` as 'st.variant.default') }))} onChange={(value) => set({ variant: value })} /> : null}
        {has('level') ? <SelectField label={t('st.prop.level')} value={String(props.level ?? 2)} options={[1, 2, 3, 4, 5, 6].map((level) => ({ value: String(level), label: `H${level}` }))} onChange={(value) => set({ level: Number(value) })} /> : null}
        {has('align') ? <SegmentedField label={t('st.prop.align')} value={String(props.align ?? 'left')} options={(['left', 'center', 'right'] as const).map((value) => ({ value, label: t(`st.align.${value}` as 'st.align.left') }))} onChange={(value) => set({ align: value })} /> : null}
        {has('size') ? <SegmentedField label={t('st.prop.size')} value={String(props.size ?? 'md')} options={(['sm', 'md', 'lg'] as const).map((value) => ({ value, label: value.toUpperCase() }))} onChange={(value) => set({ size: value })} /> : null}
        {component.type === 'divider' ? <SegmentedField label={t('st.prop.lineStyle')} value={String(props.variant ?? 'solid')} options={(['solid', 'dashed', 'dotted'] as const).map((value) => ({ value, label: t(`st.line.${value}` as 'st.line.solid') }))} onChange={(value) => set({ variant: value })} /> : null}
        {has('spacing') ? <SegmentedField label={t('st.prop.spacing')} value={String(props.spacing ?? 'md')} options={(['sm', 'md', 'lg'] as const).map((value) => ({ value, label: value.toUpperCase() }))} onChange={(value) => set({ spacing: value })} /> : null}
        {has('striped') ? <ToggleField label={t('st.prop.striped')} checked={props.striped === true} onChange={(value) => set({ striped: value })} /> : null}
        {has('ordered') ? <ToggleField label={t('st.prop.ordered')} checked={props.ordered === true} onChange={(value) => set({ ordered: value })} /> : null}
        {has('newTab') ? <ToggleField label={t('st.prop.newTab')} checked={props.openInNewTab === true} onChange={(value) => set({ openInNewTab: value })} /> : null}
      </Group>
      {has('height') || has('orientation') || has('stacking') || has('chartVariant') || has('color') ? (
        <Group title={t('st.group.chart')}>
          {has('height') ? <SliderField label={t('st.prop.height')} value={Number(props.height ?? 280)} min={160} max={800} step={20} suffix="px" onChange={(value) => set({ height: value })} /> : null}
          {has('orientation') ? <ToggleField label={t('st.prop.horizontal')} checked={props.horizontal === true} onChange={(value) => set({ horizontal: value })} /> : null}
          {has('stacking') ? <SegmentedField label={t('st.prop.stacking')} value={String(props.variant ?? 'grouped')} options={[{ value: 'grouped', label: t('st.stack.grouped') }, { value: 'stacked', label: t('st.stack.stacked') }]} onChange={(value) => set({ variant: value })} /> : null}
          {has('chartVariant') && component.type === 'line_chart' ? <SegmentedField label={t('st.prop.chartVariant')} value={String(props.variant ?? 'line')} options={[{ value: 'line', label: t('st.chart.line') }, { value: 'area', label: t('st.chart.area') }]} onChange={(value) => set({ variant: value })} /> : null}
          {has('chartVariant') && component.type === 'donut_chart' ? <SegmentedField label={t('st.prop.chartVariant')} value={String(props.variant ?? 'donut')} options={[{ value: 'donut', label: t('st.chart.donut') }, { value: 'pie', label: t('st.chart.pie') }]} onChange={(value) => set({ variant: value })} /> : null}
          {has('color') && component.type === 'donut_chart' ? <ColorField label={t('st.prop.color')} value={typeof props.color === 'string' ? props.color : undefined} onChange={(value) => set({ color: value })} onClear={() => set({ color: undefined })} clearLabel={t('st.prop.colorClear')} /> : null}
          {has('color') && component.type !== 'donut_chart' ? series.map((item) => (
            <ColorField key={item.key} label={`${t('st.prop.seriesColor')}: ${item.label?.es ?? item.label?.en ?? item.key}`} value={item.color} onChange={(value) => setSeriesColor(item.key, value)} onClear={() => setSeriesColor(item.key, undefined)} clearLabel={t('st.prop.colorClear')} />
          )) : null}
        </Group>
      ) : null}
      {component.type === 'bar_chart' ? <Group title={t('ai.chart.group')}><ToggleField label={t('ai.chart.showValues')} checked={props.showValues === true} onChange={(value) => set({ showValues: value || undefined })} /></Group> : null}
      {component.type === 'donut_chart' ? (
        <Group title={t('ai.chart.group')}>
          <SegmentedField label={t('ai.chart.legend')} value={String(props.legend ?? 'none')} options={(['none', 'right', 'bottom'] as const).map((value) => ({ value, label: t(`ai.chart.legend.${value}` as 'ai.chart.legend.none') }))} onChange={(value) => set({ legend: value === 'none' ? undefined : value })} />
          <ToggleField label={t('ai.chart.showTotal')} checked={props.showTotal === true} onChange={(value) => set({ showTotal: value || undefined })} />
          <NumberField label={t('ai.chart.maxSlices')} value={Number(props.maxSlices ?? 12)} min={2} max={12} onChange={(value) => set({ maxSlices: value >= 12 ? undefined : value })} help={t('ai.chart.maxSlicesHelp')} />
        </Group>
      ) : null}
      <p className="text-[11px] leading-4 text-text-muted">{t('st.appearance.note')}</p>
    </>
  );
}

function DataTabHost({ panelId, organizationId, component, bindings, onBindingsChanged }: { panelId: string; organizationId: string; component: Component; bindings: ReadonlyArray<PanelBinding>; onBindingsChanged: () => Promise<void> }) {
  const { edit, updateComponentProps } = useViewsEditor();
  return (
    <>
    <DataTab
      organizationId={organizationId}
      panelId={panelId}
      component={component}
      bindings={bindings}
      onBindingsChanged={onBindingsChanged}
      onAttach={(binding, props) => edit((doc) => setComponentProps(setComponentBinding(doc, component.id, DATA_BINDING_KEY, { sourceType: 'dataset', sourceId: binding.id, datasetId: binding.datasetId }), component.id, props))}
      onDetach={() => edit((doc) => setComponentBinding(doc, component.id, DATA_BINDING_KEY, null))}
      onProps={(props) => updateComponentProps('', component.id, props)}
    />
    <SlotBindings component={component} bindings={bindings} />
    </>
  );
}

function AdvancedTab({ component }: { component: Component }) {
  const { t } = useI18n();
  const { commit, getDocument, selectComponent, clearComponentSelection } = useViewsEditor();
  const [copied, setCopied] = useState(false);
  return (
    <>
      <Group title={t('st.group.identity')}>
        <dl className="space-y-1.5 text-xs">
          <div className="flex justify-between gap-2"><dt className="text-text-muted">{t('st.adv.type')}</dt><dd className="font-mono text-text">{component.type}@{component.schemaVersion}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-text-muted">{t('st.adv.id')}</dt>
            <dd className="min-w-0 truncate font-mono text-[11px] text-text" title={component.id}>{component.id}</dd></div>
        </dl>
        <Button size="sm" variant="ghost" onClick={() => { void navigator.clipboard?.writeText(component.id).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}>{copied ? t('st.adv.copied') : t('st.adv.copyId')}</Button>
      </Group>
      <Group title={t('st.group.actions')}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => { const doc = getDocument(); const copy = doc ? duplicateComponent(doc, component.id) : null; if (copy) { commit(copy.doc); const f = findComponent(copy.doc, copy.componentId); if (f) selectComponent(f.section.id, copy.componentId); } }}><Copy aria-hidden="true" />{t('st.canvas.duplicate')}</Button>
          <Button size="sm" variant="outline" className="text-error" onClick={() => { const doc = getDocument(); if (doc) { commit(removeComponent(doc, component.id)); clearComponentSelection(); } }}><Trash aria-hidden="true" />{t('st.canvas.remove')}</Button>
        </div>
      </Group>
      <Group title={t('st.group.pending')}>
        <p className="text-[11px] leading-4 text-text-muted">{t('st.adv.pending')}</p>
      </Group>
    </>
  );
}
