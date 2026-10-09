import { useMemo, useState } from 'react';
import { Database, Plus, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { listDatasetFields, listDatasets, type DatasetField, type DatasetSummary } from '@/features/admin-center/api';
import { useResource } from '@/features/admin-center/hooks';
import { measuresFor, type FieldType, type Measure } from '@/features/queries/queryBuilder';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { bindingColumns, measureAlias, staleKeys, suggestProps, type FieldInfo } from './bindingModel';
import type { Component } from './documentOps';
import { SelectField, TextField, Group, Field, NumberField } from './fields';
import { DATA_BINDING_KEY, definitionOf } from './registry';
import { createPanelBinding, type AllowedFilter, type PanelBinding } from './studioApi';

const localName = (value: Record<string, string> | undefined, locale: string) => (value ? value[locale] ?? value.es ?? value.en ?? Object.values(value)[0] ?? '' : '');

/** Filters a viewer may apply, by field type. Operators are the ones the dataset contract supports for that type. */
const FILTER_OPERATORS: Record<FieldType, AllowedFilter['operators']> = {
  TEXT: ['EQ', 'IN', 'CONTAINS'], BOOLEAN: ['EQ'], INTEGER: ['EQ', 'GTE', 'LTE'], DECIMAL: ['EQ', 'GTE', 'LTE'], DATE: ['GTE', 'LTE'], DATETIME: ['GTE', 'LTE'], TIME: ['GTE', 'LTE'],
};

async function fieldInfoOf(organizationId: string, datasetId: string, locale: string): Promise<Map<string, FieldInfo>> {
  const fields = await listDatasetFields(organizationId, datasetId);
  return new Map(fields.filter((field) => field.status === 'ACTIVE').map((field) => [field.id, { label: localName(field.displayName, locale) || field.key, type: field.canonicalType }]));
}

function useFieldInfo(organizationId: string, datasetId: string | undefined) {
  const resource = useResource<DatasetField[]>(() => (datasetId ? listDatasetFields(organizationId, datasetId) : Promise.resolve([])), [organizationId, datasetId]);
  const { locale } = useI18n();
  const info = useMemo(() => new Map<string, FieldInfo>((resource.data ?? []).filter((field) => field.status === 'ACTIVE').map((field) => [field.id, { label: localName(field.displayName, locale) || field.key, type: field.canonicalType }])), [resource.data, locale]);
  return { info, fields: resource.data ?? [], status: resource.status };
}

export function DataTab({ organizationId, panelId, component, bindings, onBindingsChanged, onAttach, onDetach, onProps }: {
  organizationId: string;
  panelId: string;
  component: Component;
  bindings: ReadonlyArray<PanelBinding>;
  onBindingsChanged: () => Promise<void>;
  onAttach: (binding: PanelBinding, props: Record<string, unknown>) => void;
  onDetach: () => void;
  onProps: (props: Record<string, unknown>) => void;
}) {
  const { t, locale } = useI18n();
  const definition = definitionOf(component.type);
  const reference = component.bindings[DATA_BINDING_KEY] as { sourceId?: string } | undefined;
  const bound = bindings.find((item) => item.id === reference?.sourceId);
  const { info } = useFieldInfo(organizationId, bound?.datasetId);
  const columns = useMemo(() => (bound ? bindingColumns(bound, info) : []), [bound, info]);
  const stale = bound ? staleKeys(component.type, component.props, columns) : [];
  const [incompatible, setIncompatible] = useState<string | null>(null);

  if (!definition || definition.binding === 'none') return <p className="text-xs leading-5 text-text-muted">{t('st.data.notBindable')}</p>;

  const attachWith = (next: PanelBinding, labels: Map<string, FieldInfo>) => {
    const suggestion = suggestProps(component.type, bindingColumns(next, labels));
    if (suggestion.compatibility !== 'ok') { setIncompatible(suggestion.compatibility === 'NO_NUMERIC' ? t('st.data.noNumeric') : t('st.data.noDimension')); return; }
    onAttach(next, suggestion.props);
  };

  const choose = async (bindingId: string) => {
    setIncompatible(null);
    if (!bindingId) { onDetach(); return; }
    const next = bindings.find((item) => item.id === bindingId);
    if (!next) return;
    // Labels come from the target dataset's own fields, never from another dataset's.
    attachWith(next, await fieldInfoOf(organizationId, next.datasetId, locale).catch(() => new Map()));
  };

  const columnOptions = columns.map((column) => ({ value: column.key, label: column.label }));
  const numericOptions = columns.filter((column) => column.numeric && column.role !== 'dimension').map((column) => ({ value: column.key, label: column.label }));
  const series = (Array.isArray(component.props.series) ? component.props.series : []) as Array<{ key: string; label: Record<string, string> }>;

  return (
    <div className="space-y-4">
      <Group title={t('st.data.source')}>
        <SelectField
          label={t('st.data.binding')}
          value={reference?.sourceId ?? ''}
          options={[{ value: '', label: bindings.length ? t('st.data.none') : t('st.data.noBindings') }, ...bindings.map((item) => ({ value: item.id, label: item.name }))]}
          onChange={(value) => void choose(value)}
          help={t('st.data.bindingHelp')}
        />
        {definition.binding === 'required' && !reference ? <p className="flex items-start gap-1.5 text-[11px] leading-4 text-warning"><WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('st.data.required')}</p> : null}
        {incompatible ? <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-4 text-error"><WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{incompatible}</p> : null}
        {bound ? <p className="text-[11px] leading-4 text-text-muted">{bound.query.mode === 'AGGREGATE' ? t('st.data.modeAggregate') : t('st.data.modeRows')} · {t('st.data.columns', { n: columns.length })}</p> : null}
      </Group>

      {bound && columns.length > 0 ? (
        <Group title={t('st.data.fields')}>
          {stale.length > 0 ? <p role="alert" className="flex items-start gap-1.5 text-[11px] leading-4 text-error"><WarningCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('st.data.stale', { fields: stale.join(', ') })}</p> : null}
          {component.type === 'metric' ? (
            <SelectField label={t('st.data.valueField')} value={String(component.props.fieldKey ?? '')} options={[{ value: '', label: '—' }, ...numericOptions]} onChange={(value) => onProps({ fieldKey: value || undefined })} />
          ) : null}
          {component.type === 'bar_chart' || component.type === 'line_chart' || component.type === 'donut_chart' ? (
            <SelectField label={t('st.data.categoryField')} value={String(component.props.categoryKey ?? '')} options={columnOptions} onChange={(value) => onProps({ categoryKey: value })} />
          ) : null}
          {component.type === 'donut_chart' ? (
            <SelectField label={t('st.data.valueField')} value={String(component.props.valueKey ?? '')} options={numericOptions} onChange={(value) => onProps({ valueKey: value })} />
          ) : null}
          {component.type === 'bar_chart' || component.type === 'line_chart' ? (
            <Field label={t('st.data.seriesFields')} help={t('st.data.seriesHelp')}>
              <ul className="space-y-1">
                {numericOptions.map((option) => {
                  const checked = series.some((item) => item.key === option.value);
                  return (
                    <li key={option.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-text hover:bg-surface-hover">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked ? series.filter((item) => item.key !== option.value) : [...series, { key: option.value, label: { es: option.label, en: option.label } }];
                            // CORECROW requires at least one series; keep the last one selected.
                            if (next.length > 0) onProps({ series: next.slice(0, 12) });
                          }}
                          className="accent-(--color-accent)"
                        />
                        <span className="truncate">{option.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Field>
          ) : null}
        </Group>
      ) : null}
      <NewBinding organizationId={organizationId} panelId={panelId} onCreated={async (binding, labels) => { await onBindingsChanged(); setIncompatible(null); attachWith(binding, labels); }} />
    </div>
  );
}

function NewBinding({ organizationId, panelId, onCreated }: { organizationId: string; panelId: string; onCreated: (binding: PanelBinding, labels: Map<string, FieldInfo>) => Promise<void> }) {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const datasets = useResource<DatasetSummary[]>(() => (open ? listDatasets(organizationId) : Promise.resolve([])), [organizationId, open]);
  const [datasetId, setDatasetId] = useState('');
  const { info, fields } = useFieldInfo(organizationId, datasetId || undefined);
  const [mode, setMode] = useState<'AGGREGATE' | 'ROWS'>('AGGREGATE');
  const [name, setName] = useState('');
  const [groupBy, setGroupBy] = useState('');
  const [operation, setOperation] = useState<Measure>('COUNT');
  const [measureField, setMeasureField] = useState('');
  const [rowFields, setRowFields] = useState<string[]>([]);
  const [filterFields, setFilterFields] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = fields.filter((field) => field.status === 'ACTIVE');
  const options = active.map((field) => ({ value: field.id, label: localName(field.displayName, locale) || field.key }));
  const measureType = measureField ? info.get(measureField)?.type ?? null : null;
  const allowedOps = measuresFor(measureType as FieldType | null);
  const needsField = operation !== 'COUNT';
  const valid = Boolean(name.trim() && datasetId && (mode === 'ROWS' ? rowFields.length > 0 : (!needsField || measureField)));

  const reset = () => { setName(''); setGroupBy(''); setOperation('COUNT'); setMeasureField(''); setRowFields([]); setFilterFields([]); setError(null); };

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const query = mode === 'ROWS'
        ? { mode: 'ROWS', fields: rowFields.slice(0, 20), limit: Math.min(limit, 200) }
        : {
            mode: 'AGGREGATE',
            ...(groupBy ? { groupBy: [groupBy] } : {}),
            measures: [{ operation, ...(needsField ? { fieldId: measureField } : {}), alias: measureAlias(operation, info.get(measureField)?.label) }],
            limit: Math.min(limit, 100),
          };
      const allowedFilters: AllowedFilter[] = filterFields.flatMap((fieldId) => {
        const type = info.get(fieldId)?.type;
        return type ? [{ fieldId, operators: FILTER_OPERATORS[type] }] : [];
      });
      const created = await createPanelBinding(organizationId, panelId, { name: name.trim(), datasetId, query, allowedFilters });
      reset(); setOpen(false);
      await onCreated(created, info);
    } catch (reason) {
      setError(reason instanceof ApiError || reason instanceof Error ? reason.message : t('st.data.createFailed'));
    } finally { setBusy(false); }
  };

  if (!open) return <Button size="sm" variant="outline" className="w-full" onClick={() => setOpen(true)}><Plus aria-hidden="true" />{t('st.data.new')}</Button>;
  return (
    <Group title={t('st.data.new')}>
      {datasets.status === 'loading' ? <p className="text-xs text-text-muted">{t('admin.loading')}</p> : null}
      {datasets.status === 'forbidden' ? <p className="text-xs text-text-muted">{t('st.data.datasetsForbidden')}</p> : null}
      {datasets.status === 'ready' && (datasets.data ?? []).length === 0 ? <p className="flex items-start gap-1.5 text-xs text-text-muted"><Database className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />{t('st.data.noDatasets')}</p> : null}
      {(datasets.data ?? []).length > 0 ? (
        <>
          <TextField label={t('st.data.bindingName')} value={name} onChange={setName} maxLength={100} />
          <SelectField label={t('st.data.dataset')} value={datasetId} options={[{ value: '', label: '—' }, ...(datasets.data ?? []).filter((d) => d.status === 'ACTIVE').map((d) => ({ value: d.id, label: localName(d.name, locale) || d.slug }))]} onChange={(value) => { setDatasetId(value); setGroupBy(''); setMeasureField(''); setRowFields([]); setFilterFields([]); }} />
          {datasetId ? (
            <>
              <SelectField label={t('st.data.mode')} value={mode} options={[{ value: 'AGGREGATE', label: t('st.data.modeAggregate') }, { value: 'ROWS', label: t('st.data.modeRows') }]} onChange={setMode} />
              {mode === 'AGGREGATE' ? (
                <>
                  <SelectField label={t('st.data.groupBy')} value={groupBy} options={[{ value: '', label: t('st.data.noGroup') }, ...options]} onChange={setGroupBy} />
                  <SelectField label={t('st.data.measureField')} value={measureField} options={[{ value: '', label: '—' }, ...options]} onChange={(value) => { setMeasureField(value); const next = measuresFor((info.get(value)?.type ?? null) as FieldType | null); if (!next.includes(operation)) setOperation('COUNT'); }} />
                  <SelectField label={t('st.data.operation')} value={operation} options={allowedOps.map((op) => ({ value: op, label: t(`st.op.${op}` as 'st.op.COUNT') }))} onChange={setOperation} />
                </>
              ) : (
                <Field label={t('st.data.rowFields')}>
                  <ul className="max-h-36 space-y-1 overflow-y-auto">
                    {options.map((option) => (
                      <li key={option.value}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-hover">
                          <input type="checkbox" checked={rowFields.includes(option.value)} onChange={() => setRowFields((current) => current.includes(option.value) ? current.filter((id) => id !== option.value) : [...current, option.value].slice(0, 20))} className="accent-(--color-accent)" />
                          <span className="truncate">{option.label}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </Field>
              )}
              <NumberField label={t('st.data.limit')} value={limit} min={1} max={mode === 'ROWS' ? 200 : 100} onChange={setLimit} />
              <Field label={t('st.data.filterFields')} help={t('st.data.filterHelp')}>
                <ul className="max-h-32 space-y-1 overflow-y-auto">
                  {options.map((option) => (
                    <li key={option.value}>
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-hover">
                        <input type="checkbox" checked={filterFields.includes(option.value)} onChange={() => setFilterFields((current) => current.includes(option.value) ? current.filter((id) => id !== option.value) : [...current, option.value].slice(0, 10))} className="accent-(--color-accent)" />
                        <span className="truncate">{option.label}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </Field>
            </>
          ) : null}
          {error ? <p role="alert" className="text-[11px] leading-4 text-error">{error}</p> : null}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setOpen(false); reset(); }}>{t('access.cancel')}</Button>
            <Button size="sm" variant="accent" loading={busy} disabled={!valid} onClick={() => void submit()}>{t('st.data.create')}</Button>
          </div>
        </>
      ) : null}
    </Group>
  );
}
