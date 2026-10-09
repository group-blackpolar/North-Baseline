import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChartBar, Code, MagnifyingGlass, Play, Plus, Table, Trash, ListMagnifyingGlass, ClockCounterClockwise } from '@phosphor-icons/react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Status } from '@/components/ui/status';
import { AnalyticsBarChart, AnalyticsDataGrid } from '@/features/analytics/AnalyticsVisuals';
import { queryDataset, type DatasetQueryResponse } from '@/features/analytics/datasetQuery';
import type { AnalyticsResult } from '@/features/analytics/types';
import { listDatasetFields, listDatasets, type DatasetField } from '@/features/admin-center/api';
import { useResource } from '@/features/admin-center/hooks';
import { SectionTabs, Unavailable, selectClass } from '@/features/admin-center/ui';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { uuid, cn } from '@/lib/utils';
import { localName } from '@/features/views/workspace/resources';
import {
  MAX_AGGREGATE_ROWS, MAX_FILTERS, MAX_GROUPS, MAX_MEASURES, MAX_ROWS, aliasFrom, buildQuery, chartableShape, columnStats, emptyBuilder, measuresFor, operatorsFor,
  type BuilderState, type Cell, type DatasetQueryRequest, type FilterDraft, type Measure, type QueryField, type UiOperator,
} from './queryBuilder';

type Run =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'error'; message: string }
  | { status: 'ready'; response: DatasetQueryResponse; request: DatasetQueryRequest; ms: number };
type HistoryEntry = { id: string; at: number; datasetId: string; label: string; state: BuilderState; rows: number | null; ms: number | null; ok: boolean };

const input = 'h-8 w-full rounded-md border border-border bg-surface px-2 text-xs text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50';

function operatorLabel(op: UiOperator, t: ReturnType<typeof useI18n>['t']) {
  return t(`adm2.q.op.${op}` as never);
}

export function QueryExplorer({ organizationId, initialDatasetId }: { organizationId: string; initialDatasetId?: string | null }) {
  const { t, locale } = useI18n();
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const [datasetId, setDatasetId] = useState<string>(initialDatasetId ?? '');
  const fieldsResource = useResource<DatasetField[]>(() => (datasetId ? listDatasetFields(organizationId, datasetId) : Promise.resolve([])), [organizationId, datasetId]);
  const [state, setState] = useState<BuilderState>(emptyBuilder);
  const [run, setRun] = useState<Run>({ status: 'idle' });
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [resultTab, setResultTab] = useState<'table' | 'summary' | 'chart' | 'schema'>('table');
  const [fieldSearch, setFieldSearch] = useState('');
  const [showRequest, setShowRequest] = useState(false);
  const abort = useRef<AbortController | null>(null);
  /** A history entry from another dataset: applied right after the dataset switch resets the builder. */
  const restore = useRef<BuilderState | null>(null);

  const fields = useMemo<QueryField[]>(() => (fieldsResource.data ?? []).filter((field) => field.status === 'ACTIVE').map((field) => ({ id: field.id, key: field.key, label: localName(field.displayName, locale) || field.key, type: field.canonicalType })), [fieldsResource.data, locale]);
  const byId = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);
  const activeDatasets = (datasets.data ?? []).filter((dataset) => dataset.status === 'ACTIVE');

  // A different dataset is a different schema: reset the builder and cancel anything in flight.
  useEffect(() => {
    abort.current?.abort();
    setRun({ status: 'idle' });
    setState(restore.current ?? emptyBuilder());
    restore.current = null;
  }, [datasetId]);
  // First fields of a freshly loaded dataset are preselected so "Run" works immediately.
  useEffect(() => {
    if (fields.length > 0) setState((current) => (current.fields.length === 0 && current.mode === 'ROWS' ? { ...current, fields: fields.slice(0, 6).map((field) => field.id) } : current));
  }, [fields]);
  useEffect(() => () => abort.current?.abort(), []);

  const patch = (next: Partial<BuilderState>) => setState((current) => ({ ...current, ...next }));
  const addFilter = () => { const first = fields[0]; if (!first) return; patch({ filters: [...state.filters, { id: uuid(), fieldId: first.id, operator: operatorsFor(first.type)[0]!, value: '', value2: '' }] }); };
  const updateFilter = (id: string, change: Partial<FilterDraft>) => patch({
    filters: state.filters.map((filter) => {
      if (filter.id !== id) return filter;
      const next = { ...filter, ...change };
      const field = byId.get(next.fieldId);
      // Changing the field can invalidate the operator and the typed value.
      if (change.fieldId && field && !operatorsFor(field.type).includes(next.operator)) { next.operator = operatorsFor(field.type)[0]!; next.value = ''; next.value2 = ''; }
      return next;
    }),
  });
  const addMeasure = () => patch({ measures: [...state.measures, { id: uuid(), operation: 'COUNT', fieldId: '', alias: aliasFrom('rows', state.measures.map((measure) => measure.alias)) }] });

  const built = useMemo(() => (datasetId && fields.length ? buildQuery(state, fields) : null), [datasetId, fields, state]);

  const execute = useCallback(async () => {
    if (!datasetId || !built) return;
    if (!built.ok) { setRun({ status: 'error', message: built.errors.map((code) => t(`adm2.q.err.${code}` as never)).join(' · ') }); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setRun({ status: 'running' });
    const started = performance.now();
    const label = `${state.mode === 'ROWS' ? t('adm2.q.mode.rows') : t('adm2.q.mode.aggregate')} · ${state.mode === 'ROWS' ? state.fields.length : state.measures.length}`;
    try {
      const response = await queryDataset(organizationId, datasetId, built.request as never, controller.signal);
      if (controller.signal.aborted) return;
      const ms = Math.round(performance.now() - started);
      setRun({ status: 'ready', response, request: built.request, ms });
      setHistory((current) => [{ id: uuid(), at: Date.now(), datasetId, label, state, rows: response.rowCount, ms, ok: true }, ...current].slice(0, 8));
    } catch (reason) {
      if (controller.signal.aborted) return;
      const status = reason instanceof ApiError ? reason.status : 0;
      const message = status === 403 ? t('adm2.q.err.forbidden') : reason instanceof Error ? reason.message : t('state.loadError');
      setRun({ status: 'error', message });
      setHistory((current) => [{ id: uuid(), at: Date.now(), datasetId, label, state, rows: null, ms: null, ok: false }, ...current].slice(0, 8));
    }
  }, [built, datasetId, organizationId, state, t]);

  const analytics = useMemo<AnalyticsResult>(() => {
    if (run.status === 'running') return { state: 'loading' };
    if (run.status !== 'ready') return { state: 'empty' };
    const columns = run.response.columns.map((column) => ({ key: column.key, label: (column.fieldId ? byId.get(column.fieldId)?.label : null) ?? column.key, align: ['INTEGER', 'DECIMAL'].includes(column.type) ? ('right' as const) : undefined }));
    return run.response.rows.length ? { state: 'ready', data: { columns, rows: run.response.rows } } : { state: 'empty', message: t('adm2.q.noRows') };
  }, [byId, run, t]);

  const resultColumns = run.status === 'ready' ? run.response.columns.map((column) => ({ key: column.key, fieldId: column.fieldId, type: column.type as QueryField['type'] })) : [];
  const stats = run.status === 'ready' ? columnStats(resultColumns, run.response.rows as Array<Record<string, Cell>>) : [];
  const chart = run.status === 'ready' ? chartableShape(resultColumns, run.response.rows) : null;
  const visibleFields = fields.filter((field) => !fieldSearch.trim() || `${field.label} ${field.key}`.toLowerCase().includes(fieldSearch.trim().toLowerCase()));
  const isAggregate = state.mode === 'AGGREGATE';
  const orderChoices = isAggregate ? [...state.groupBy.map((id) => ({ key: id, label: byId.get(id)?.label ?? id })), ...state.measures.map((measure) => ({ key: measure.alias, label: measure.alias }))] : fields.map((field) => ({ key: field.id, label: field.label }));

  if (datasets.status === 'forbidden') return <Unavailable tone="forbidden" title={t('adm2.q.forbidden')} body={t('adm2.q.forbiddenBody')} />;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <DashboardCard title={t('adm2.q.builder')} description={t('adm2.q.builderHint')} className="min-w-0 self-start">
        <label className="block space-y-1">
          <span className="ui-label">{t('adm2.q.dataset')}</span>
          <select className={cn(selectClass, 'w-full')} value={datasetId} onChange={(event) => setDatasetId(event.target.value)} disabled={datasets.status === 'loading'}>
            <option value="">{datasets.status === 'loading' ? t('admin.loading') : t('adm2.q.pickDataset')}</option>
            {activeDatasets.map((dataset) => <option key={dataset.id} value={dataset.id}>{localName(dataset.name, locale)}</option>)}
          </select>
        </label>
        {datasets.status === 'error' ? <p role="alert" className="text-xs text-error">{datasets.error}</p> : null}

        {datasetId && fieldsResource.status === 'loading' ? <p className="text-xs text-text-muted">{t('admin.loading')}</p> : null}
        {datasetId && fieldsResource.status === 'error' ? <p role="alert" className="text-xs text-error">{fieldsResource.error}</p> : null}

        {datasetId && fields.length > 0 ? (
          <>
            <div className="inline-flex w-full gap-1 rounded-lg bg-surface-hover p-1" role="group" aria-label={t('adm2.q.mode')}>
              {(['ROWS', 'AGGREGATE'] as const).map((mode) => (
                <button key={mode} type="button" aria-pressed={state.mode === mode} onClick={() => patch({ mode, orderBy: [], limit: Math.min(state.limit, mode === 'ROWS' ? MAX_ROWS : MAX_AGGREGATE_ROWS) })} className={cn('flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast) pointer-coarse:min-h-(--touch-min)', state.mode === mode ? 'bg-surface text-text shadow-soft' : 'text-text-muted hover:text-text')}>
                  {mode === 'ROWS' ? t('adm2.q.mode.rows') : t('adm2.q.mode.aggregate')}
                </button>
              ))}
            </div>

            {!isAggregate ? (
              <fieldset className="space-y-1.5">
                <legend className="ui-label">{t('adm2.q.columns')} <span className="text-text-muted">({state.fields.length})</span></legend>
                <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" /><Input className="pl-7" value={fieldSearch} onChange={(event) => setFieldSearch(event.target.value)} placeholder={t('adm2.q.searchFields')} aria-label={t('adm2.q.searchFields')} /></div>
                <ul className="max-h-52 space-y-0.5 overflow-y-auto pr-1">
                  {visibleFields.map((field) => (
                    <li key={field.id}>
                      <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs hover:bg-surface-hover pointer-coarse:min-h-(--touch-min)">
                        <input type="checkbox" checked={state.fields.includes(field.id)} onChange={(event) => patch({ fields: event.target.checked ? [...state.fields, field.id] : state.fields.filter((id) => id !== field.id) })} />
                        <span className="min-w-0 flex-1 truncate text-text">{field.label}</span>
                        <span className="shrink-0 rounded bg-surface-active px-1 text-[10px] uppercase text-text-muted">{field.type}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : (
              <>
                <fieldset className="space-y-1.5">
                  <legend className="ui-label">{t('adm2.q.groupBy')} <span className="text-text-muted">(≤ {MAX_GROUPS})</span></legend>
                  {state.groupBy.map((id, index) => (
                    <div key={`${id}-${index}`} className="flex gap-1.5">
                      <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('adm2.q.groupBy')} value={id} onChange={(event) => patch({ groupBy: state.groupBy.map((value, position) => (position === index ? event.target.value : value)) })}>
                        {fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}
                      </select>
                      <Button size="icon-sm" variant="ghost" aria-label={t('adm2.q.remove')} onClick={() => patch({ groupBy: state.groupBy.filter((_, position) => position !== index), orderBy: [] })}><Trash className="size-3.5" /></Button>
                    </div>
                  ))}
                  {state.groupBy.length < MAX_GROUPS ? <Button size="sm" variant="ghost" onClick={() => { const free = fields.find((field) => !state.groupBy.includes(field.id)); if (free) patch({ groupBy: [...state.groupBy, free.id] }); }}><Plus className="size-3.5" />{t('adm2.q.addGroup')}</Button> : null}
                </fieldset>
                <fieldset className="space-y-1.5">
                  <legend className="ui-label">{t('adm2.q.measures')}</legend>
                  {state.measures.map((measure) => {
                    const field = measure.fieldId ? byId.get(measure.fieldId) : undefined;
                    return (
                      <div key={measure.id} className="space-y-1 rounded-lg border border-border p-1.5">
                        <div className="flex gap-1.5">
                          <select className={cn(selectClass, 'w-28')} aria-label={t('adm2.q.operation')} value={measure.operation} onChange={(event) => patch({ measures: state.measures.map((item) => (item.id === measure.id ? { ...item, operation: event.target.value as Measure } : item)) })}>
                            {measuresFor(field?.type ?? null).concat(measure.operation !== 'COUNT' && !measuresFor(field?.type ?? null).includes(measure.operation) ? [measure.operation] : []).map((op) => <option key={op} value={op}>{op}</option>)}
                          </select>
                          <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('adm2.q.field')} value={measure.fieldId} onChange={(event) => { const next = byId.get(event.target.value); patch({ measures: state.measures.map((item) => (item.id === measure.id ? { ...item, fieldId: event.target.value, operation: next && !measuresFor(next.type).includes(item.operation) ? 'COUNT' : item.operation } : item)) }); }}>
                            <option value="">{t('adm2.q.allRows')}</option>
                            {fields.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-1.5">
                          <input className={cn(input, 'font-mono')} aria-label={t('adm2.q.alias')} value={measure.alias} maxLength={64} onChange={(event) => patch({ measures: state.measures.map((item) => (item.id === measure.id ? { ...item, alias: event.target.value } : item)) })} />
                          <Button size="icon-sm" variant="ghost" aria-label={t('adm2.q.remove')} onClick={() => patch({ measures: state.measures.filter((item) => item.id !== measure.id), orderBy: [] })}><Trash className="size-3.5" /></Button>
                        </div>
                      </div>
                    );
                  })}
                  {state.measures.length < MAX_MEASURES ? <Button size="sm" variant="ghost" onClick={addMeasure}><Plus className="size-3.5" />{t('adm2.q.addMeasure')}</Button> : null}
                </fieldset>
              </>
            )}

            <fieldset className="space-y-1.5">
              <legend className="ui-label">{t('adm2.q.filters')} <span className="text-text-muted">({state.filters.length}/{MAX_FILTERS})</span></legend>
              {state.filters.map((filter) => {
                const field = byId.get(filter.fieldId);
                const nullary = filter.operator === 'IS_NULL' || filter.operator === 'IS_NOT_NULL';
                const inputType = field?.type === 'DATE' ? 'date' : field?.type === 'TIME' ? 'time' : field?.type === 'DATETIME' ? 'datetime-local' : field?.type === 'INTEGER' || field?.type === 'DECIMAL' ? 'number' : 'text';
                const valueInput = (value: string, key: 'value' | 'value2') => field?.type === 'BOOLEAN'
                  ? <select className={cn(selectClass, 'w-full')} aria-label={t('adm2.q.value')} value={value} onChange={(event) => updateFilter(filter.id, { [key]: event.target.value })}><option value="">—</option><option value="true">{t('analytics.true')}</option><option value="false">{t('analytics.false')}</option></select>
                  : <input className={input} type={inputType} step={field?.type === 'DECIMAL' ? 'any' : undefined} aria-label={t('adm2.q.value')} value={value} onChange={(event) => updateFilter(filter.id, { [key]: event.target.value })} />;
                return (
                  <div key={filter.id} className="space-y-1 rounded-lg border border-border p-1.5">
                    <div className="flex gap-1.5">
                      <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('adm2.q.field')} value={filter.fieldId} onChange={(event) => updateFilter(filter.id, { fieldId: event.target.value })}>{fields.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
                      <Button size="icon-sm" variant="ghost" aria-label={t('adm2.q.remove')} onClick={() => patch({ filters: state.filters.filter((item) => item.id !== filter.id) })}><Trash className="size-3.5" /></Button>
                    </div>
                    <select className={cn(selectClass, 'w-full')} aria-label={t('adm2.q.operator')} value={filter.operator} onChange={(event) => updateFilter(filter.id, { operator: event.target.value as UiOperator })}>
                      {(field ? operatorsFor(field.type) : []).map((op) => <option key={op} value={op}>{operatorLabel(op, t)}</option>)}
                    </select>
                    {!nullary ? <div className={cn('grid gap-1.5', filter.operator === 'BETWEEN' && 'grid-cols-2')}>{valueInput(filter.value, 'value')}{filter.operator === 'BETWEEN' ? valueInput(filter.value2, 'value2') : null}</div> : null}
                  </div>
                );
              })}
              {state.filters.length < MAX_FILTERS ? <Button size="sm" variant="ghost" onClick={addFilter}><Plus className="size-3.5" />{t('adm2.q.addFilter')}</Button> : null}
              <p className="text-[11px] text-text-muted">{t('adm2.q.filtersNote')}</p>
            </fieldset>

            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <label className="space-y-1">
                <span className="ui-label">{t('adm2.q.orderBy')}</span>
                <div className="flex gap-1.5">
                  <select className={cn(selectClass, 'min-w-0 flex-1')} aria-label={t('adm2.q.orderBy')} value={state.orderBy[0]?.key ?? ''} onChange={(event) => patch({ orderBy: event.target.value ? [{ key: event.target.value, direction: state.orderBy[0]?.direction ?? 'ASC' }] : [] })}>
                    <option value="">—</option>
                    {orderChoices.map((choice) => <option key={choice.key} value={choice.key}>{choice.label}</option>)}
                  </select>
                  <select className={cn(selectClass, 'w-16')} aria-label={t('adm2.q.direction')} value={state.orderBy[0]?.direction ?? 'ASC'} disabled={!state.orderBy[0]} onChange={(event) => patch({ orderBy: state.orderBy.map((item) => ({ ...item, direction: event.target.value as 'ASC' | 'DESC' })) })}><option>ASC</option><option>DESC</option></select>
                </div>
              </label>
              <label className="space-y-1"><span className="ui-label">{t('adm2.q.limit')}</span><input className={input} type="number" min={1} max={isAggregate ? MAX_AGGREGATE_ROWS : MAX_ROWS} value={state.limit} onChange={(event) => patch({ limit: Number(event.target.value) || 1 })} /></label>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="accent" className="flex-1" loading={run.status === 'running'} disabled={!built} onClick={() => void execute()}><Play weight="fill" />{t('adm2.q.run')}</Button>
              <Button size="icon" variant="ghost" aria-label={t('adm2.q.showRequest')} aria-pressed={showRequest} onClick={() => setShowRequest((value) => !value)}><Code /></Button>
            </div>
            {showRequest ? (
              <div className="space-y-1">
                <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-surface-hover/50 p-2 text-[11px] leading-relaxed">{built?.ok ? JSON.stringify(built.request, null, 2) : built ? built.errors.map((code) => t(`adm2.q.err.${code}` as never)).join('\n') : ''}</pre>
                <p className="text-[11px] text-text-muted">{t('adm2.q.requestNote')}</p>
              </div>
            ) : null}
          </>
        ) : datasetId && fieldsResource.status === 'ready' ? <EmptyState icon={ListMagnifyingGlass} title={t('adm2.q.noFields')} /> : null}
      </DashboardCard>

      <div className="min-w-0 space-y-4">
        <DashboardCard
          title={t('adm2.q.results')}
          description={run.status === 'ready' ? t('adm2.q.executed', { rows: run.response.rowCount, ms: run.ms }) : t('adm2.q.resultsHint')}
          actions={run.status === 'ready' ? <Status tone="active">{run.response.mode}</Status> : undefined}
        >
          {run.status === 'idle' ? (
            <EmptyState icon={Table} title={datasetId ? t('adm2.q.readyToRun') : t('adm2.q.pickDataset')} body={datasetId ? t('adm2.q.readyToRunBody') : t('adm2.q.pickDatasetBody')} className="py-14" />
          ) : run.status === 'error' ? (
            <div role="alert" className="rounded-lg border border-error/40 bg-error/5 p-3 text-xs text-error">{run.message}</div>
          ) : (
            <div className="space-y-3">
              <SectionTabs
                label={t('adm2.q.results')} value={resultTab} onChange={setResultTab}
                tabs={[
                  { id: 'table', label: t('adm2.q.tab.table'), icon: Table },
                  { id: 'summary', label: t('adm2.q.tab.summary'), icon: ListMagnifyingGlass },
                  ...(chart ? [{ id: 'chart' as const, label: t('adm2.q.tab.chart'), icon: ChartBar }] : []),
                  { id: 'schema', label: t('adm2.q.tab.schema'), icon: Code },
                ]}
              />
              {resultTab === 'table' || run.status === 'running' ? <AnalyticsDataGrid result={analytics} /> : null}
              {run.status === 'ready' && resultTab === 'summary' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="np-card p-3"><p className="ui-label">{t('adm2.q.rowsReturned')}</p><p className="font-display text-xl font-semibold tabular-nums">{run.response.rowCount}</p></div>
                    <div className="np-card p-3"><p className="ui-label">{t('adm2.q.columnsReturned')}</p><p className="font-display text-xl font-semibold tabular-nums">{run.response.columns.length}</p></div>
                    <div className="np-card p-3"><p className="ui-label">{t('adm2.q.duration')}</p><p className="font-display text-xl font-semibold tabular-nums">{run.ms} ms</p></div>
                    <div className="np-card p-3"><p className="ui-label">{t('adm2.q.revision')}</p><p className="mono-data truncate text-sm">{run.response.activeRevisionId.slice(0, 8)}</p></div>
                  </div>
                  <p className="text-[11px] text-text-muted">{t('adm2.q.statsNote')}</p>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="min-w-full border-separate border-spacing-0 text-xs">
                      <thead><tr>{['key', 'type', 'count', 'nulls', 'distinct', 'min', 'max', 'mean'].map((head) => <th key={head} className="border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted">{t(`adm2.q.stat.${head}` as never)}</th>)}</tr></thead>
                      <tbody>{stats.map((stat) => <tr key={stat.key}><td className="border-b border-border/60 px-3 py-1.5 font-medium">{stat.key}</td><td className="border-b border-border/60 px-3 py-1.5 text-text-muted">{stat.type}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.count}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.nulls}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.distinct}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.min ?? '—'}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.max ?? '—'}</td><td className="border-b border-border/60 px-3 py-1.5 tabular-nums">{stat.mean !== undefined ? stat.mean.toLocaleString(locale, { maximumFractionDigits: 2 }) : '—'}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              ) : null}
              {run.status === 'ready' && resultTab === 'chart' && chart ? (
                <AnalyticsBarChart result={analytics} categoryKey={chart.label.key} series={[{ key: chart.value.key, label: byId.get(chart.value.fieldId ?? '')?.label ?? chart.value.key }]} height={300} />
              ) : null}
              {run.status === 'ready' && resultTab === 'schema' ? (
                <ul className="divide-y divide-border/60 rounded-lg border border-border text-xs">
                  {run.response.columns.map((column) => <li key={column.key} className="flex items-center justify-between gap-3 px-3 py-1.5"><span className="font-medium">{column.key}</span><span className="mono-data text-text-muted">{column.type}</span></li>)}
                </ul>
              ) : null}
            </div>
          )}
        </DashboardCard>

        {history.length > 0 ? (
          <DashboardCard title={t('adm2.q.history')} description={t('adm2.q.historyHint')}>
            <ul className="divide-y divide-border/60">
              {history.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 py-1.5 text-xs">
                  <ClockCounterClockwise className="size-3.5 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                  <span className="shrink-0 tabular-nums text-text-muted">{entry.ok ? `${entry.rows} · ${entry.ms} ms` : t('adm2.q.failed')}</span>
                  <time className="shrink-0 text-text-muted" dateTime={new Date(entry.at).toISOString()}>{new Date(entry.at).toLocaleTimeString(locale)}</time>
                  <Button size="sm" variant="ghost" onClick={() => { if (entry.datasetId === datasetId) setState(entry.state); else { restore.current = entry.state; setDatasetId(entry.datasetId); } }}>{t('adm2.q.reuse')}</Button>
                </li>
              ))}
            </ul>
          </DashboardCard>
        ) : null}
      </div>
    </div>
  );
}
