import { ArrowDown, ArrowUp, CaretDown, CaretLeft, CaretRight, CaretUpDown, Columns, DotsThreeVertical, DownloadSimple, Eye, EyeSlash, FunnelSimple, MagnifyingGlass, WarningCircle } from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Popover } from '@/components/ui/popover';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkline } from '@/components/charts/Sparkline';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { DatasetQueryFilter } from '../datasetQuery';
import type { AnalyticsRow } from '../types';
import { analyticsRows, bindingIdOf, useBindingResult, useBindingSource } from './bindingSource';
import { asNumber, formatValue, localizedText, TONE_VARS, toneOf, type ValueFormat } from './format';
import { defaultView, moveColumn, pageWindow, parseColumns, reconcileView, rowKeyOf, sparklineSeries, toCsv, toggleColumn, trendDirection, visibleColumns, type GridColumn, type GridView } from './gridState';

type Props = Record<string, unknown>;
type Sort = { key: string; direction: 'ASC' | 'DESC' };
type TrendConfig = { binding: string; rowKeys: string[]; categoryKey: string; valueKey: string };

const EXPORT_CAP = 10_000;
const PAGE_FETCH = 1_000;

function readTrend(value: unknown): TrendConfig | null {
  if (!value || typeof value !== 'object') return null;
  const trend = value as Record<string, unknown>;
  const keys = Array.isArray(trend.rowKeys) ? trend.rowKeys.filter((key): key is string => typeof key === 'string') : [];
  return typeof trend.binding === 'string' && typeof trend.categoryKey === 'string' && typeof trend.valueKey === 'string' && keys.length ? { binding: trend.binding, rowKeys: keys, categoryKey: trend.categoryKey, valueKey: trend.valueKey } : null;
}

function useGridView(storageKey: string, columns: GridColumn[]) {
  const columnsKey = columns.map((column) => column.key).join('|');
  const [view, setView] = useState<GridView>(() => {
    try { return reconcileView(JSON.parse(sessionStorage.getItem(storageKey) ?? 'null'), columns); } catch { return defaultView(columns); }
  });
  // Column definitions can change in the editor: keep the user's order/visibility for columns that still exist.
  useEffect(() => { setView((current) => reconcileView(current, columns)); }, [columnsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = useCallback((next: GridView) => {
    setView(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage unavailable */ }
  }, [storageKey]);
  return [view, update] as const;
}

/**
 * Advanced data grid over one paged binding. Sorting, search, paging and the total are server-side (CORECROW applies them
 * to the binding's own output columns); sparklines come from the optional `trend` binding for the rows on screen only.
 */
export function DataGridPro({ componentId, panelKey, props, bindings, locales }: { componentId: string; panelKey: string; props: Props; bindings: Record<string, unknown>; locales: string[] }) {
  const { t, locale } = useI18n();
  const source = useBindingSource();
  const dataId = bindingIdOf(bindings, 'data');
  const columns = useMemo(() => parseColumns(props.columns, (raw) => localizedText(raw, locales)), [locales, props.columns]);
  const trend = useMemo(() => readTrend(props.trend), [props.trend]);
  const trendId = trend ? bindingIdOf(bindings, trend.binding) : null;
  const pageSizes = useMemo(() => (Array.isArray(props.pageSizes) ? props.pageSizes.filter((size): size is number => typeof size === 'number' && size >= 5 && size <= 200) : []), [props.pageSizes]);
  const sizes = pageSizes.length ? pageSizes : [10, 20, 50];
  const defaultSize = typeof props.defaultPageSize === 'number' && sizes.includes(props.defaultPageSize) ? props.defaultPageSize : sizes[0]!;
  const searchable = props.searchable !== false;
  const selectable = props.selectable === true;
  const exportable = props.exportable !== false;
  const title = localizedText(props.title, locales);
  const defaultSort = (props.defaultSort && typeof (props.defaultSort as Sort).key === 'string' ? props.defaultSort as Sort : undefined);
  const inspectorKeys = Array.isArray(props.inspectorKeys) ? props.inspectorKeys.filter((key): key is string => typeof key === 'string') : null;

  const [view, setView] = useGridView(`north-grid-v1:${panelKey}:${componentId}`, columns);
  const [sort, setSort] = useState<Sort | undefined>(defaultSort);
  const [pageSize, setPageSize] = useState(defaultSize);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inspected, setInspected] = useState<AnalyticsRow | null>(null);
  const [exporting, setExporting] = useState<{ done: number; total: number } | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchDraft.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  const request = useMemo(() => ({ ...(sort ? { sort } : {}), offset: (page - 1) * pageSize, limit: pageSize, ...(search ? { search } : {}) }), [page, pageSize, search, sort]);
  const data = useBindingResult(dataId, request);
  const rows = useMemo(() => (data.response ? analyticsRows(data.response) : []), [data.response]);
  const total = data.response?.totalRows ?? rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  // Any change of the dataset the reader is looking at (filters, search, sort) returns to the first page.
  const filtersJson = JSON.stringify(source && dataId ? source.filtersFor(dataId) : []);
  useEffect(() => { setPage(1); setSelected(new Set()); }, [filtersJson, search, sort?.key, sort?.direction, pageSize]);
  useEffect(() => { if (page > pages) setPage(pages); }, [page, pages]);

  // Sparklines: one request for the rows on screen, limited to their own keys.
  const trendRequest = useMemo(() => {
    if (!trend || !trendId || !rows.length || columns.every((column) => column.kind !== 'sparkline')) return null;
    const filters: DatasetQueryFilter[] = trend.rowKeys.slice(0, 2).map((key) => ({ fieldId: key, operator: 'IN', value: [...new Set(rows.map((row) => row[key]).filter((value): value is string | number => typeof value === 'string' || typeof value === 'number'))].slice(0, 100) }));
    return filters.every((filter) => Array.isArray(filter.value) && filter.value.length) ? { filters } : null;
  }, [columns, rows, trend, trendId]);
  const trendData = useBindingResult(trendRequest ? trendId : null, trendRequest ?? {});
  const series = useMemo(() => (trend && trendData.response ? sparklineSeries(analyticsRows(trendData.response), trend.rowKeys, trend.categoryKey, trend.valueKey) : new Map<string, number[]>()), [trend, trendData.response]);

  const shown = visibleColumns(columns, view);
  const maxima = useMemo(() => Object.fromEntries(columns.filter((column) => column.kind === 'bar').map((column) => [column.key, Math.max(0, ...rows.map((row) => asNumber(row[column.key]) ?? 0))])), [columns, rows]);
  const rowId = (row: AnalyticsRow, index: number) => (trend ? rowKeyOf(row, trend.rowKeys) : `${page}:${index}`);
  const numberFormat = new Intl.NumberFormat(locale);

  const toggleSort = (column: GridColumn) => {
    if (column.sortable === false || column.kind === 'sparkline' || column.kind === 'actions') return;
    setSort((current) => (current?.key !== column.key ? { key: column.key, direction: 'DESC' } : current.direction === 'DESC' ? { key: column.key, direction: 'ASC' } : defaultSort && defaultSort.key !== column.key ? defaultSort : undefined));
  };

  const exportCsv = async () => {
    if (!source || !dataId) return;
    setExportNote(null);
    const all: AnalyticsRow[] = [];
    const controller = new AbortController();
    try {
      let offset = 0;
      let grand = total;
      setExporting({ done: 0, total: Math.min(total, EXPORT_CAP) });
      while (offset < grand && all.length < EXPORT_CAP) {
        const response = await source.fetch(dataId, { filters: source.filtersFor(dataId), ...(sort ? { sort } : {}), ...(search ? { search } : {}), offset, limit: PAGE_FETCH }, controller.signal);
        const chunk = analyticsRows(response);
        if (!chunk.length) break;
        all.push(...chunk);
        grand = response.totalRows ?? grand;
        offset += chunk.length;
        setExporting({ done: Math.min(all.length, EXPORT_CAP), total: Math.min(grand, EXPORT_CAP) });
      }
      const exportable = all.slice(0, EXPORT_CAP);
      const exportColumns = shown.filter((column) => column.kind !== 'sparkline' && column.kind !== 'actions');
      const blob = new Blob([`﻿${toCsv(exportColumns, exportable)}`], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), { href: url, download: `${(title || 'export').replace(/[^\w.-]+/g, '_')}.csv` });
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      if (grand > EXPORT_CAP) setExportNote(t('grid.exportCapped', { n: numberFormat.format(EXPORT_CAP) }));
    } catch {
      setExportNote(t('grid.exportError'));
    } finally {
      setExporting(null);
    }
  };

  const cell = (column: GridColumn, row: AnalyticsRow, id: string) => {
    const raw = row[column.key] ?? null;
    if (column.kind === 'sparkline') {
      const values = series.get(id);
      if (!values || values.length < 2) return <span className="text-text-muted">{trendData.status === 'loading' ? '' : '—'}</span>;
      const direction = trendDirection(values);
      const color = direction === 'up' ? '#1F9D63' : direction === 'down' ? '#E0475B' : 'var(--color-text-muted)';
      return <Sparkline values={values} color={color} className="h-6 w-20" label={t('grid.trend')} />;
    }
    if (column.kind === 'bar') {
      const value = asNumber(raw);
      const max = maxima[column.key] ?? 0;
      return (
        <div className="flex items-center justify-end gap-2">
          <span className="tabular-nums">{formatValue(raw, 'number', locale)}</span>
          <span className="h-1.5 w-12 shrink-0 overflow-hidden rounded-full bg-border/70" aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${max && value ? Math.max(4, (value / max) * 100) : 0}%`, background: TONE_VARS[toneOf(column.barTone)].fg }} /></span>
        </div>
      );
    }
    if (column.kind === 'badge') return raw === null ? <span className="text-text-muted">—</span> : <span className="inline-flex max-w-full items-center rounded-md bg-surface-hover px-1.5 py-0.5 text-[0.72rem] font-medium text-text-secondary"><span className="truncate" title={String(raw)}>{String(raw)}</span></span>;
    const format: ValueFormat = column.kind === 'number' ? 'number' : column.kind === 'decimal' ? 'decimal' : column.kind === 'date' ? 'date' : column.kind === 'month' ? 'month' : 'text';
    const text = formatValue(raw, format, locale);
    return <span className="block truncate" title={text}>{text}</span>;
  };

  const align = (column: GridColumn) => column.align ?? (['number', 'decimal', 'bar'].includes(column.kind) ? 'right' : 'left');
  const filterable = (key: string) => Boolean(source?.applyFilter && source.canFilter?.(key));

  return (
    <div className="flex h-full min-h-0 flex-col" data-grid>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="mr-auto min-w-0 truncate font-display text-[0.95rem] font-semibold text-text">
          {title}{data.response && total > 0 ? <span className="ml-1.5 text-xs font-normal text-text-muted">({numberFormat.format(Math.min(total, (page - 1) * pageSize + 1))} - {numberFormat.format(Math.min(total, page * pageSize))})</span> : null}
        </h3>
        {searchable ? (
          <label className="relative block">
            <span className="sr-only">{t('grid.search')}</span>
            <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder={t('grid.search')} className="h-8 w-44 rounded-md border border-border bg-surface pl-7 pr-2 text-base outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 md:text-xs" />
          </label>
        ) : null}
        {exportable ? (
          <button type="button" onClick={() => void exportCsv()} disabled={!data.response || total === 0 || exporting !== null} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-50">
            <DownloadSimple className="size-3.5" aria-hidden="true" />{exporting ? `${numberFormat.format(exporting.done)} / ${numberFormat.format(exporting.total)}` : t('grid.export')}
          </button>
        ) : null}
        <ColumnsMenu columns={columns} view={view} onChange={setView} />
      </div>
      {exportNote ? <p role="status" className="mb-2 text-xs text-text-muted">{exportNote}</p> : null}

      <div className={cn('relative min-h-0 flex-1 overflow-auto rounded-lg border border-border', data.refreshing && 'opacity-70 transition-opacity')} aria-busy={data.status === 'loading' || data.refreshing}>
        {data.status === 'error' ? (
          <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-2 text-xs text-error"><WarningCircle className="size-5" aria-hidden="true" />{data.error?.message || t('analytics.error')}<button type="button" className="rounded-md border border-border px-2.5 py-1 font-medium text-text hover:bg-surface-hover" onClick={data.reload}>{t('flt.retry')}</button></div>
        ) : data.status !== 'ready' && !data.response ? (
          <div className="space-y-1.5 p-3" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-6 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <p role="status" className="flex min-h-40 items-center justify-center px-4 text-center text-xs text-text-muted">{t('grid.empty')}</p>
        ) : (
          <table className="w-full border-separate border-spacing-0 text-left text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[color-mix(in_srgb,var(--color-surface-hover)_70%,var(--color-surface))]">
                {selectable ? <th scope="col" className="w-8 border-b border-border px-2"><span className="sr-only">{t('grid.select')}</span></th> : null}
                {shown.map((column) => {
                  const active = sort?.key === column.key;
                  const Icon = !active ? CaretUpDown : sort.direction === 'ASC' ? ArrowUp : ArrowDown;
                  const sortableColumn = column.sortable !== false && column.kind !== 'sparkline' && column.kind !== 'actions';
                  const width = view.widths[column.key] ?? column.width;
                  return (
                    <th key={column.key} scope="col" style={width ? { width } : undefined} aria-sort={active ? (sort.direction === 'ASC' ? 'ascending' : 'descending') : 'none'} className="group/th relative border-b border-border p-0 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">
                      <button type="button" disabled={!sortableColumn} onClick={() => toggleSort(column)} className={cn('flex h-9 w-full items-center gap-1 px-3 transition-colors', align(column) === 'right' && 'justify-end', align(column) === 'center' && 'justify-center', sortableColumn && 'hover:bg-surface-hover hover:text-text')}>
                        <span className="truncate">{column.label}</span>
                        {sortableColumn ? <Icon className={cn('size-3 shrink-0', active ? 'text-accent' : 'text-text-muted/70')} aria-hidden="true" /> : null}
                      </button>
                      <ResizeHandle onResize={(next) => setView({ ...view, widths: { ...view.widths, [column.key]: next } })} current={width ?? 160} label={column.label} />
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => {
                const id = rowId(row, index);
                const checked = selected.has(id);
                return (
                  <tr key={id} className={cn('group/row transition-colors duration-100 hover:bg-accent-soft/50', checked && 'bg-accent-soft/60')}>
                    {selectable ? <td className="border-b border-border/60 px-2"><input type="checkbox" aria-label={t('grid.select')} checked={checked} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; })} className="size-3.5 accent-(--color-accent)" /></td> : null}
                    {shown.map((column) => (
                      <td key={column.key} className={cn('h-9 max-w-[22rem] border-b border-border/60 px-3 text-text', align(column) === 'right' && 'text-right tabular-nums', align(column) === 'center' && 'text-center')}>
                        {column.kind === 'actions'
                          ? <RowMenu row={row} columns={columns} onInspect={() => setInspected(row)} filterable={filterable} onFilter={(key, value) => source?.applyFilter?.(key, value)} />
                          : column.key === shown[0]?.key && !selectable && column.kind === 'text'
                            ? <button type="button" onClick={() => setInspected(row)} className="block w-full truncate text-left font-medium hover:text-accent focus-visible:outline-none focus-visible:underline" title={String(row[column.key] ?? '')}>{String(row[column.key] ?? '—')}</button>
                            : cell(column, row, id)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span>{t('grid.rowsPerPage')}</span>
            <span className="relative inline-flex">
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-7 appearance-none rounded-md border border-border bg-surface pl-2 pr-6 text-xs text-text outline-none focus-visible:ring-2 focus-visible:ring-accent/25">
                {sizes.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              <CaretDown className="pointer-events-none absolute right-1.5 top-1/2 size-3 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            </span>
          </label>
          <span className="tabular-nums text-text-muted">{total ? t('grid.range', { from: numberFormat.format((page - 1) * pageSize + 1), to: numberFormat.format(Math.min(total, page * pageSize)), total: numberFormat.format(total) }) : null}{selectable && selected.size ? ` · ${t('grid.selected', { n: selected.size })}` : ''}</span>
        </div>
        <nav aria-label={t('grid.pagination')} className="flex items-center gap-0.5">
          <PagerButton label={t('grid.prev')} disabled={page <= 1} onClick={() => setPage(page - 1)}><CaretLeft className="size-3.5" aria-hidden="true" /></PagerButton>
          {pageWindow(page, pages).map((item, index) => item === null
            ? <span key={`gap-${index}`} className="px-1 text-text-muted" aria-hidden="true">…</span>
            : <button key={item} type="button" aria-current={item === page ? 'page' : undefined} aria-label={t('grid.page', { n: item })} onClick={() => setPage(item)} className={cn('h-7 min-w-7 rounded-md px-1.5 text-xs font-medium tabular-nums transition-colors', item === page ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-hover hover:text-text')}>{numberFormat.format(item)}</button>)}
          <PagerButton label={t('grid.next')} disabled={page >= pages} onClick={() => setPage(page + 1)}><CaretRight className="size-3.5" aria-hidden="true" /></PagerButton>
        </nav>
      </div>

      <Sheet open={inspected !== null} onOpenChange={(open) => { if (!open) setInspected(null); }} side="right" title={inspected ? String(inspected[shown[0]?.key ?? columns[0]?.key ?? ''] ?? t('grid.details')) : t('grid.details')} description={t('grid.details')}>
        {inspected ? <Inspector row={inspected} columns={(inspectorKeys ? inspectorKeys.map((key) => columns.find((column) => column.key === key)).filter((column): column is GridColumn => Boolean(column)) : columns).filter((column) => column.kind !== 'actions' && column.kind !== 'sparkline')} series={series.get(rowId(inspected, rows.indexOf(inspected)))} filterable={filterable} onFilter={(key, value) => { source?.applyFilter?.(key, value); setInspected(null); }} /> : null}
      </Sheet>
    </div>
  );
}

function PagerButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className="inline-flex size-7 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-surface-hover hover:text-text disabled:pointer-events-none disabled:opacity-40">{children}</button>;
}

function ResizeHandle({ current, onResize, label }: { current: number; onResize: (width: number) => void; label: string }) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const down = (event: ReactPointerEvent<HTMLSpanElement>) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); start.current = { x: event.clientX, width: current }; };
  const move = (event: ReactPointerEvent<HTMLSpanElement>) => { if (start.current) onResize(Math.max(48, Math.min(640, Math.round(start.current.width + (event.clientX - start.current.x))))); };
  const up = (event: ReactPointerEvent<HTMLSpanElement>) => { start.current = null; event.currentTarget.releasePointerCapture(event.pointerId); };
  return <span role="separator" aria-orientation="vertical" aria-label={label} onPointerDown={down} onPointerMove={move} onPointerUp={up} className="absolute right-0 top-1.5 h-6 w-1.5 cursor-col-resize touch-none rounded-full bg-transparent transition-colors hover:bg-accent/40 group-hover/th:bg-border" />;
}

function ColumnsMenu({ columns, view, onChange }: { columns: GridColumn[]; view: GridView; onChange: (view: GridView) => void }) {
  const { t } = useI18n();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const byKey = new Map(columns.map((column) => [column.key, column]));
  return (
    <>
      <button ref={anchor} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text">
        <Columns className="size-3.5" aria-hidden="true" />{t('grid.columns')}
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchor} label={t('grid.columns')} minWidth={240}>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto p-1.5">
          {view.order.map((key, index) => {
            const column = byKey.get(key);
            if (!column) return null;
            const hidden = view.hidden.includes(key);
            return (
              <li key={key} className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-surface-hover">
                <button type="button" aria-pressed={!hidden} aria-label={`${hidden ? t('grid.showColumn') : t('grid.hideColumn')}: ${column.label}`} onClick={() => onChange(toggleColumn(view, key))} className="inline-flex size-6 items-center justify-center rounded text-text-secondary hover:text-text">{hidden ? <EyeSlash className="size-3.5" aria-hidden="true" /> : <Eye className="size-3.5" aria-hidden="true" />}</button>
                <span className={cn('min-w-0 flex-1 truncate text-xs', hidden && 'text-text-muted line-through')}>{column.label}</span>
                <button type="button" aria-label={`${t('grid.moveUp')}: ${column.label}`} disabled={index === 0} onClick={() => onChange(moveColumn(view, key, -1))} className="inline-flex size-6 items-center justify-center rounded text-text-secondary hover:bg-surface hover:text-text disabled:opacity-30"><ArrowUp className="size-3" aria-hidden="true" /></button>
                <button type="button" aria-label={`${t('grid.moveDown')}: ${column.label}`} disabled={index === view.order.length - 1} onClick={() => onChange(moveColumn(view, key, 1))} className="inline-flex size-6 items-center justify-center rounded text-text-secondary hover:bg-surface hover:text-text disabled:opacity-30"><ArrowDown className="size-3" aria-hidden="true" /></button>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border px-3 py-1.5"><button type="button" className="text-[11px] font-medium text-accent hover:underline" onClick={() => onChange(defaultView(columns))}>{t('grid.resetColumns')}</button></div>
      </Popover>
    </>
  );
}

function RowMenu({ row, columns, onInspect, filterable, onFilter }: { row: AnalyticsRow; columns: GridColumn[]; onInspect: () => void; filterable: (key: string) => boolean; onFilter: (key: string, value: string | number | boolean) => void }) {
  const { t } = useI18n();
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const filters = columns.filter((column) => (column.kind === 'text' || column.kind === 'badge') && filterable(column.key) && typeof row[column.key] === 'string');
  return (
    <div className="flex justify-center">
      <button ref={anchor} type="button" aria-label={t('grid.actions')} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="inline-flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-hover hover:text-text"><DotsThreeVertical className="size-4" weight="bold" aria-hidden="true" /></button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchor} label={t('grid.actions')} minWidth={220}>
        <ul role="menu" className="space-y-0.5 p-1">
          <li role="none"><button type="button" role="menuitem" onClick={() => { setOpen(false); onInspect(); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-hover"><Eye className="size-3.5" aria-hidden="true" />{t('grid.inspect')}</button></li>
          {filters.map((column) => (
            <li role="none" key={column.key}><button type="button" role="menuitem" onClick={() => { setOpen(false); onFilter(column.key, row[column.key] as string); }} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-surface-hover"><FunnelSimple className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{t('grid.filterBy', { name: column.label })}</span></button></li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

function Inspector({ row, columns, series, filterable, onFilter }: { row: AnalyticsRow; columns: GridColumn[]; series?: number[]; filterable: (key: string) => boolean; onFilter: (key: string, value: string | number | boolean) => void }) {
  const { t, locale } = useI18n();
  return (
    <div className="space-y-4">
      {series && series.length > 1 ? <section aria-label={t('grid.trend')} className="rounded-lg border border-border p-3"><p className="mb-1 text-[0.68rem] font-semibold uppercase tracking-wide text-text-muted">{t('grid.trend')}</p><Sparkline values={series} color={trendDirection(series) === 'down' ? '#E0475B' : '#1F9D63'} className="h-14 w-full" label={t('grid.trend')} /></section> : null}
      <dl className="divide-y divide-border/60">
        {columns.map((column) => {
          const format: ValueFormat = column.kind === 'number' || column.kind === 'bar' ? 'number' : column.kind === 'decimal' ? 'decimal' : column.kind === 'date' ? 'date' : column.kind === 'month' ? 'month' : 'text';
          const raw = row[column.key] ?? null;
          return (
            <div key={column.key} className="flex items-start justify-between gap-3 py-2">
              <dt className="shrink-0 text-xs text-text-muted">{column.label}</dt>
              <dd className="min-w-0 break-words text-right text-xs font-medium text-text">
                {formatValue(raw, format, locale)}
                {typeof raw === 'string' && filterable(column.key) ? <button type="button" onClick={() => onFilter(column.key, raw)} className="ml-2 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"><FunnelSimple className="size-3" aria-hidden="true" />{t('grid.filter')}</button> : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

