import { ArrowDown, ArrowUp, Plus, Trash } from '@phosphor-icons/react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { listDatasetFields, type DatasetField } from '@/features/admin-center/api';
import { useResource } from '@/features/admin-center/hooks';
import { ICON_NAMES } from '@/features/analytics/pro/icons';
import { useI18n } from '@/lib/i18n';
import { bindingColumns, type FieldInfo, type ResultColumn } from './bindingModel';
import { makeId, setComponentBinding, type Component } from './documentOps';
import { Field, Group, SelectField, TextField, ToggleField } from './fields';
import { definitionOf } from './registry';
import type { PanelBinding } from './studioApi';
import { useViewsEditor } from '../ViewsEditorContext';

const TONES = ['blue', 'violet', 'green', 'amber', 'rose', 'cyan', 'slate'] as const;
const FORMATS = ['number', 'decimal', 'percent', 'text', 'date', 'month'] as const;
const GRID_KINDS = ['text', 'number', 'decimal', 'date', 'month', 'bar', 'badge', 'sparkline', 'actions'] as const;
const RULES = ['leader_share', 'period_change', 'top_concentration'] as const;

type Localized = Record<string, string>;
const textOf = (value: unknown, locale: string): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const entry = record[locale] ?? record.es ?? record.en ?? Object.values(record)[0];
  return typeof entry === 'string' ? entry : '';
};
const withText = (current: unknown, locale: string, value: string): Localized => {
  const next = { ...((current as Localized | undefined) ?? {}) };
  if (value.trim()) next[locale] = value; else delete next[locale];
  return next;
};
const localName = (value: Record<string, string> | undefined, locale: string) => (value ? value[locale] ?? value.es ?? value.en ?? Object.values(value)[0] ?? '' : '');

/** Named binding slots of a component: the registry's fixed ones, plus the names an insights card refers to. */
export function slotsOf(component: Component): string[] {
  if (component.type === 'insights') {
    const names = new Set<string>();
    for (const item of Array.isArray(component.props.items) ? component.props.items : []) { const name = (item as { binding?: unknown }).binding; if (typeof name === 'string') names.add(name); }
    return [...names];
  }
  return ['data', ...(definitionOf(component.type)?.slots ?? [])];
}

/** Result columns of every slot the component has bound, with human labels from the dataset's own fields. */
export function useSlotColumns(organizationId: string, component: Component, bindings: ReadonlyArray<PanelBinding>) {
  const { locale } = useI18n();
  const datasetIds = [...new Set(Object.values(component.bindings).flatMap((reference) => { const ref = reference as { sourceType?: string; datasetId?: string }; return ref?.sourceType === 'dataset' && ref.datasetId ? [ref.datasetId] : []; }))];
  const fields = useResource<DatasetField[]>(async () => (await Promise.all(datasetIds.map((id) => listDatasetFields(organizationId, id).catch(() => [])))).flat(), [organizationId, datasetIds.join('|')]);
  return useMemo(() => {
    const info = new Map<string, FieldInfo>((fields.data ?? []).filter((field) => field.status === 'ACTIVE').map((field) => [field.id, { label: localName(field.displayName, locale) || field.key, type: field.canonicalType }]));
    const bySlot = new Map<string, ResultColumn[]>();
    for (const [slot, reference] of Object.entries(component.bindings)) {
      const binding = bindings.find((item) => item.id === (reference as { sourceId?: string })?.sourceId);
      if (binding) bySlot.set(slot, bindingColumns(binding, info));
    }
    return bySlot;
  }, [bindings, component.bindings, fields.data, locale]);
}

const optionsOf = (columns: ResultColumn[], numericOnly = false) => [{ value: '', label: '—' }, ...columns.filter((column) => !numericOnly || (column.numeric && column.role !== 'dimension')).map((column) => ({ value: column.key, label: column.label }))];

/** Content properties of the analytics components. Every key is chosen from the real columns of the attached bindings. */
export function AnalyticsFields({ component, columnsBySlot }: { component: Component; columnsBySlot: Map<string, ResultColumn[]> }) {
  const { t, locale } = useI18n();
  const { updateComponentProps } = useViewsEditor();
  const set = (patch: Record<string, unknown>) => updateComponentProps('', component.id, patch);
  const props = component.props;
  const data = columnsBySlot.get('data') ?? [];
  const localized = (key: string, label: string, max = 200) => <TextField label={label} value={textOf(props[key], locale)} onChange={(value) => set({ [key]: withText(props[key], locale, value) })} maxLength={max} />;

  if (component.type === 'filter_bar') return <Group title={t('st.group.content')}>{localized('title', t('st.prop.title'))}<p className="text-[11px] leading-4 text-text-muted">{t('ai.filterBar.help')}</p></Group>;

  if (component.type === 'kpi_card') {
    const subtitle = (props.subtitle as { mode?: string; text?: unknown; valueKey?: string; totalKey?: string } | undefined) ?? undefined;
    const total = columnsBySlot.get('total') ?? [];
    const comparison = props.comparison as { label?: unknown; inverse?: boolean } | undefined;
    return (
      <>
        <Group title={t('st.group.content')}>
          {localized('label', t('st.prop.label'))}
          <SelectField label={t('ai.kpi.valueKey')} value={String(props.valueKey ?? '')} options={optionsOf(data)} onChange={(value) => set({ valueKey: value })} />
          <SelectField label={t('st.prop.format')} value={String(props.format ?? 'number')} options={FORMATS.map((value) => ({ value, label: t(`ai.format.${value}` as 'ai.format.number') }))} onChange={(value) => set({ format: value })} />
          {localized('unit', t('ai.kpi.unit'), 40)}
          {localized('tooltip', t('ai.kpi.tooltip'), 300)}
        </Group>
        <Group title={t('ai.kpi.look')}>
          <SelectField label={t('ai.kpi.icon')} value={String(props.icon ?? 'chart')} options={ICON_NAMES.map((value) => ({ value, label: value }))} onChange={(value) => set({ icon: value })} />
          <SelectField label={t('ai.kpi.tone')} value={String(props.tone ?? 'blue')} options={TONES.map((value) => ({ value, label: t(`ai.tone.${value}` as 'ai.tone.blue') }))} onChange={(value) => set({ tone: value })} />
          <SelectField label={t('st.prop.variant')} value={String(props.variant ?? 'standard')} options={(['compact', 'standard', 'trend', 'comparison'] as const).map((value) => ({ value, label: t(`ai.kpi.variant.${value}` as 'ai.kpi.variant.compact') }))} onChange={(value) => set({ variant: value })} />
        </Group>
        <Group title={t('ai.kpi.compareGroup')}>
          <ToggleField label={t('ai.kpi.compare')} checked={Boolean(comparison)} onChange={(value) => set({ comparison: value ? {} : undefined })} help={t('ai.kpi.compareHelp')} />
          {comparison ? <ToggleField label={t('ai.kpi.inverse')} checked={comparison.inverse === true} onChange={(value) => set({ comparison: { ...comparison, inverse: value || undefined } })} /> : null}
          <SelectField label={t('ai.kpi.subtitle')} value={subtitle?.mode ?? 'none'} options={(['none', 'text', 'share', 'relative_date'] as const).map((value) => ({ value, label: t(`ai.kpi.sub.${value}` as 'ai.kpi.sub.none') }))}
            onChange={(mode) => set({ subtitle: mode === 'none' ? undefined : mode === 'text' ? { mode, text: withText(undefined, locale, t('ai.kpi.sub.text')) } : mode === 'share' ? { mode, valueKey: String(props.valueKey ?? ''), totalKey: total[0]?.key ?? '' } : { mode } })} />
          {subtitle?.mode === 'text' ? <TextField label={t('ai.kpi.subText')} value={textOf(subtitle.text, locale)} onChange={(value) => set({ subtitle: { mode: 'text', text: withText(subtitle.text, locale, value || ' ') } })} maxLength={120} /> : null}
          {subtitle?.mode === 'share' ? (
            <>
              <SelectField label={t('ai.kpi.shareValue')} value={subtitle.valueKey ?? ''} options={optionsOf(data, true)} onChange={(value) => set({ subtitle: { ...subtitle, valueKey: value } })} />
              <SelectField label={t('ai.kpi.shareTotal')} value={subtitle.totalKey ?? ''} options={optionsOf(total, true)} onChange={(value) => set({ subtitle: { ...subtitle, totalKey: value } })} help={t('ai.kpi.shareHelp')} />
            </>
          ) : null}
        </Group>
      </>
    );
  }

  if (component.type === 'geo_map') {
    return (
      <Group title={t('st.group.content')}>
        {localized('title', t('st.prop.title'))}
        <SelectField label={t('ai.map.region')} value={String(props.regionKey ?? '')} options={optionsOf(data)} onChange={(value) => set({ regionKey: value })} />
        <SelectField label={t('ai.map.value')} value={String(props.valueKey ?? '')} options={optionsOf(data, true)} onChange={(value) => set({ valueKey: value })} />
        <SelectField label={t('ai.map.secondary')} value={String(props.secondaryKey ?? '')} options={optionsOf(data, true)} onChange={(value) => set({ secondaryKey: value || undefined })} />
        {localized('valueLabel', t('ai.map.valueLabel'), 60)}
        {localized('secondaryLabel', t('ai.map.secondaryLabel'), 60)}
        <SelectField label={t('ai.kpi.tone')} value={String(props.tone ?? 'blue')} options={TONES.map((value) => ({ value, label: t(`ai.tone.${value}` as 'ai.tone.blue') }))} onChange={(value) => set({ tone: value })} />
      </Group>
    );
  }

  if (component.type === 'data_grid') {
    const columns = (Array.isArray(props.columns) ? props.columns : []) as Array<{ key: string; label: Localized; kind?: string; hidden?: boolean; sortable?: boolean }>;
    const used = new Set(columns.map((column) => column.key));
    const addable = data.filter((column) => !used.has(column.key));
    const move = (index: number, offset: -1 | 1) => { const next = [...columns]; const target = index + offset; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target]!, next[index]!]; set({ columns: next }); };
    const patch = (index: number, change: Record<string, unknown>) => set({ columns: columns.map((column, position) => (position === index ? { ...column, ...change } : column)) });
    const trend = props.trend as { binding?: string; rowKeys?: string[]; categoryKey?: string; valueKey?: string } | undefined;
    const trendColumns = columnsBySlot.get('trend') ?? [];
    return (
      <>
        <Group title={t('st.group.content')}>
          {localized('title', t('st.prop.title'))}
          <ToggleField label={t('ai.grid.searchable')} checked={props.searchable !== false} onChange={(value) => set({ searchable: value })} help={t('ai.grid.searchableHelp')} />
          <ToggleField label={t('ai.grid.selectable')} checked={props.selectable === true} onChange={(value) => set({ selectable: value })} />
          <ToggleField label={t('ai.grid.exportable')} checked={props.exportable !== false} onChange={(value) => set({ exportable: value })} />
          <SelectField label={t('ai.grid.pageSize')} value={String(props.defaultPageSize ?? 20)} options={(Array.isArray(props.pageSizes) && props.pageSizes.length ? props.pageSizes as number[] : [10, 20, 50]).map((size) => ({ value: String(size), label: String(size) }))} onChange={(value) => set({ defaultPageSize: Number(value) })} />
        </Group>
        <Group title={t('ai.grid.columns')}>
          <ul className="space-y-2">
            {columns.map((column, index) => (
              <li key={`${column.key}:${index}`} className="space-y-1.5 rounded-lg border border-border p-2">
                <div className="flex items-center gap-1">
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-muted" title={column.key}>{column.key}</span>
                  <button type="button" aria-label={t('grid.moveUp')} disabled={index === 0} onClick={() => move(index, -1)} className="rounded p-1 text-text-muted hover:bg-surface-hover disabled:opacity-30"><ArrowUp className="size-3" /></button>
                  <button type="button" aria-label={t('grid.moveDown')} disabled={index === columns.length - 1} onClick={() => move(index, 1)} className="rounded p-1 text-text-muted hover:bg-surface-hover disabled:opacity-30"><ArrowDown className="size-3" /></button>
                  <button type="button" aria-label={t('st.canvas.remove')} disabled={columns.length <= 1} onClick={() => set({ columns: columns.filter((_, position) => position !== index) })} className="rounded p-1 text-error hover:bg-error/10 disabled:opacity-30"><Trash className="size-3" /></button>
                </div>
                <TextField label={t('st.prop.label')} value={textOf(column.label, locale)} onChange={(value) => patch(index, { label: withText(column.label, locale, value || column.key) })} maxLength={80} />
                <SelectField label={t('ai.grid.kind')} value={column.kind ?? 'text'} options={GRID_KINDS.map((value) => ({ value, label: t(`ai.grid.kind.${value}` as 'ai.grid.kind.text') }))} onChange={(value) => patch(index, { kind: value })} />
                <ToggleField label={t('ai.grid.hidden')} checked={column.hidden === true} onChange={(value) => patch(index, { hidden: value || undefined })} />
              </li>
            ))}
          </ul>
          {addable.length ? (
            <Field label={t('ai.grid.addColumn')}>
              <div className="flex flex-wrap gap-1.5">{addable.slice(0, 12).map((column) => <Button key={column.key} size="sm" variant="outline" onClick={() => set({ columns: [...columns, { key: column.key, label: { es: column.label, en: column.label }, kind: column.numeric ? 'number' : 'text' }].slice(0, 30) })}><Plus aria-hidden="true" />{column.label}</Button>)}</div>
            </Field>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => set({ columns: [...columns, { key: 'actions', label: { es: 'Acciones', en: 'Actions' }, kind: 'actions', align: 'center' }].slice(0, 30) })} disabled={columns.some((column) => column.kind === 'actions')}><Plus aria-hidden="true" />{t('ai.grid.addActions')}</Button>
        </Group>
        <Group title={t('ai.grid.trendGroup')}>
          <p className="text-[11px] leading-4 text-text-muted">{t('ai.grid.trendHelp')}</p>
          {trend ? (
            <>
              <SelectField label={t('ai.grid.trendCategory')} value={trend.categoryKey ?? ''} options={optionsOf(trendColumns)} onChange={(value) => set({ trend: { ...trend, categoryKey: value } })} />
              <SelectField label={t('ai.grid.trendValue')} value={trend.valueKey ?? ''} options={optionsOf(trendColumns, true)} onChange={(value) => set({ trend: { ...trend, valueKey: value } })} />
              <Field label={t('ai.grid.trendKeys')} help={t('ai.grid.trendKeysHelp')}>
                <ul className="space-y-1">{data.filter((column) => column.role !== 'measure').map((column) => { const checked = trend.rowKeys?.includes(column.key); return <li key={column.key}><label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-surface-hover"><input type="checkbox" checked={checked} onChange={() => set({ trend: { ...trend, rowKeys: checked ? (trend.rowKeys ?? []).filter((key) => key !== column.key) : [...(trend.rowKeys ?? []), column.key].slice(0, 3) } })} className="accent-(--color-accent)" /><span className="truncate">{column.label}</span></label></li>; })}</ul>
              </Field>
              <Button size="sm" variant="ghost" onClick={() => set({ trend: undefined })}>{t('ai.grid.trendOff')}</Button>
            </>
          ) : <Button size="sm" variant="outline" onClick={() => set({ trend: { binding: 'trend', rowKeys: data.filter((column) => column.role === 'dimension').slice(0, 2).map((column) => column.key), categoryKey: trendColumns.find((column) => column.role === 'dimension')?.key ?? '', valueKey: trendColumns.find((column) => column.numeric && column.role !== 'dimension')?.key ?? '' } })}>{t('ai.grid.trendOn')}</Button>}
        </Group>
      </>
    );
  }

  if (component.type === 'insights') {
    const items = (Array.isArray(props.items) ? props.items : []) as Array<{ id: string; rule: string; binding: string; labelKey?: string; valueKey?: string; top?: number; title: Localized; tone?: string; icon?: string }>;
    const patch = (index: number, change: Record<string, unknown>) => set({ items: items.map((item, position) => (position === index ? { ...item, ...change } : item)) });
    return (
      <>
        <Group title={t('st.group.content')}>{localized('title', t('st.prop.title'))}</Group>
        <Group title={t('ai.insight.items')}>
          <ul className="space-y-2">
            {items.map((item, index) => {
              const columns = columnsBySlot.get(item.binding) ?? [];
              return (
                <li key={item.id} className="space-y-1.5 rounded-lg border border-border p-2">
                  <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-text-secondary">{t(`ai.insight.rule.${item.rule}` as 'ai.insight.rule.leader_share')}</span><button type="button" aria-label={t('st.canvas.remove')} disabled={items.length <= 1} onClick={() => set({ items: items.filter((_, position) => position !== index) })} className="rounded p-1 text-error hover:bg-error/10 disabled:opacity-30"><Trash className="size-3" /></button></div>
                  <SelectField label={t('ai.insight.ruleLabel')} value={item.rule} options={RULES.map((value) => ({ value, label: t(`ai.insight.rule.${value}` as 'ai.insight.rule.leader_share') }))} onChange={(value) => patch(index, { rule: value })} />
                  <TextField label={t('st.prop.title')} value={textOf(item.title, locale)} onChange={(value) => patch(index, { title: withText(item.title, locale, value || ' ') })} maxLength={120} />
                  <TextField label={t('ai.insight.binding')} value={item.binding} onChange={(value) => patch(index, { binding: value.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 64) })} mono help={t('ai.insight.bindingHelp')} />
                  {item.rule !== 'period_change' ? <SelectField label={t('ai.insight.labelKey')} value={item.labelKey ?? ''} options={optionsOf(columns)} onChange={(value) => patch(index, { labelKey: value || undefined })} /> : null}
                  <SelectField label={t('ai.insight.valueKey')} value={item.valueKey ?? ''} options={optionsOf(columns, true)} onChange={(value) => patch(index, { valueKey: value })} />
                  {item.rule === 'top_concentration' ? <TextField label={t('ai.insight.top')} value={String(item.top ?? 3)} onChange={(value) => patch(index, { top: Math.min(10, Math.max(1, Number(value) || 1)) })} /> : null}
                  <SelectField label={t('ai.kpi.tone')} value={item.tone ?? 'blue'} options={TONES.map((value) => ({ value, label: t(`ai.tone.${value}` as 'ai.tone.blue') }))} onChange={(value) => patch(index, { tone: value })} />
                  <SelectField label={t('ai.kpi.icon')} value={item.icon ?? 'chart'} options={ICON_NAMES.map((value) => ({ value, label: value }))} onChange={(value) => patch(index, { icon: value })} />
                </li>
              );
            })}
          </ul>
          {items.length < 6 ? <Button size="sm" variant="outline" onClick={() => set({ items: [...items, { id: makeId(), rule: 'leader_share', binding: 'data', labelKey: '', valueKey: '', title: { es: 'Insight', en: 'Insight' } }] })}><Plus aria-hidden="true" />{t('ai.insight.add')}</Button> : null}
        </Group>
      </>
    );
  }
  return null;
}

/** One selector per named binding the component reads. `data` is handled by the main Data tab; these are the extras. */
export function SlotBindings({ component, bindings }: { component: Component; bindings: ReadonlyArray<PanelBinding> }) {
  const { t } = useI18n();
  const { edit } = useViewsEditor();
  const slots = slotsOf(component).filter((slot) => slot !== 'data' || component.type === 'insights');
  if (!slots.length) return null;
  return (
    <Group title={t('ai.slots.title')}>
      <p className="text-[11px] leading-4 text-text-muted">{t('ai.slots.help')}</p>
      {slots.map((slot) => {
        const current = (component.bindings[slot] as { sourceId?: string } | undefined)?.sourceId ?? '';
        return (
          <SelectField key={slot} label={['data', 'total', 'trend'].includes(slot) ? t(`ai.slot.${slot}` as 'ai.slot.total') : slot} value={current}
            options={[{ value: '', label: t('st.data.none') }, ...bindings.map((item) => ({ value: item.id, label: item.name }))]}
            onChange={(value) => { const binding = bindings.find((item) => item.id === value); edit((doc) => setComponentBinding(doc, component.id, slot, binding ? { sourceType: 'dataset', sourceId: binding.id, datasetId: binding.datasetId } : null)); }} />
        );
      })}
    </Group>
  );
}
