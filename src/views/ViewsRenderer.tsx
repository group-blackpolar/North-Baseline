import { Fragment, lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowsClockwise, ArrowsIn, ArrowsOut, ArrowsOutSimple, Barricade, CaretLeft, Presentation } from '@phosphor-icons/react';
import type { SessionUser } from '@/lib/auth';
import type { Tab } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { adminSectionOf } from '@/features/admin-center/sections';
import { PersonalView } from '@/features/personal/PersonalView';
import { OrganizationHome } from '@/features/home/OrganizationHome';
import { ReportCardsBlock } from '@/features/home/ReportCardsBlock';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { AnalyticsBarChart, AnalyticsDataGrid, AnalyticsDonutChart, AnalyticsKpi, AnalyticsLineAreaChart } from '@/features/analytics/AnalyticsVisuals';
import type { AnalyticsColumn, AnalyticsResult, AnalyticsValue } from '@/features/analytics/types';
import type { DatasetQueryFilter } from '@/features/analytics/datasetQuery';
import type { PanelBindingFilterDefinition } from '@/features/analytics/panelBindingQuery';
import { Dialog } from '@/components/ui/dialog';
import { publishedBarChartProps, publishedDonutChartProps, publishedLineChartProps, publishedMetricField } from '@/features/analytics/publishedVisualProps';
import type { PublishedPanelBinding, PublishedPanelDocument } from '@/lib/organizations';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useI18n } from '@/lib/i18n';
import { intlTag } from '@/lib/intlTag';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentWorkspaceHost } from '@/features/documents/DocumentsWorkspace';
import { useShowcaseSlug } from '@/features/showcase/ShowcaseContext';
import { FilterBar, type FacetLoader, type FilterControl } from '@/features/filters/FilterBar';
import { queryPanelFacet } from '@/features/filters/facetsApi';
import { analyticsRows, bindingIdOf, BindingSourceProvider, useBindingResult, useBindingSource, type BindingResponse, type BindingSource, type BindingState } from '@/features/analytics/pro/bindingSource';
import { asNumber } from '@/features/analytics/pro/format';
import { PRO_TYPES, ProComponent } from '@/features/analytics/pro/ProComponent';
import { queryPanelAnalyticsBinding } from '@/features/analytics/panelBindingQuery';
import { queryShowcaseBinding } from '@/lib/showcase';
import { consumePanelRequest, peekPanelRequest, subscribePanelRequests } from '@/features/assistant/panelBus';
import { selectionsFromFilters } from '@/features/assistant/directives';
import { chipsOf, filterModeOf, filtersForDefinitions, loadSelections, saveSelections, type FilterSelections } from '@/features/filters/filterModel';
import { PresentationMode } from '@/features/presentation/PresentationMode';
import { cn } from '@/lib/utils';
import { CellFillProvider } from '@/features/analytics/cellFill';
import { PanelGroup } from '@/features/analytics/pro/PanelGroup';
import { DefinitionListBlock, HeroBlock, LinkCardsBlock, TitleBarBlock, OrgBrand, PanelNavigationContext, usePanelNavigation } from '@/features/analytics/pro/InfoBlocks';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import { useTabs } from '@/context/TabsContext';

// Administration is the largest authenticated surface and most sessions never open it: load it on demand.
const AdminCenter = lazy(() => import('@/features/admin-center/AdminCenter').then((module) => ({ default: module.AdminCenter })));

const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences', 'settings', 'platform-administration']);
const GAP = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;

const localized = (value: unknown, locales: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return String(locales.map((locale) => record[locale]).find((entry) => typeof entry === 'string') ?? Object.values(record).find((entry) => typeof entry === 'string') ?? '');
};

const safeHref = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol) ? value : null; } catch { return null; }
};

function PanelLink({ slug, children, className }: { slug: string; children: ReactNode; className?: string }) {
  const open = usePanelNavigation();
  return open
    ? <button type="button" onClick={() => open(slug)} className={cn('text-left text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:underline', className)}>{children}</button>
    : <span className={className}>{children}</span>;
}

function RichNode({ node }: { node: unknown }) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const value = node as { type?: string; text?: string; content?: unknown[]; href?: string };
  const children = Array.isArray(value.content) ? value.content.map((child, index) => <RichNode key={index} node={child} />) : null;
  if (value.type === 'text') return <>{value.text ?? ''}</>;
  if (value.type === 'paragraph') return <p className="leading-7">{children}</p>;
  if (value.type === 'heading') return <h3 className="font-display text-lg font-semibold">{children}</h3>;
  if (value.type === 'bullet_list') return <ul className="list-disc pl-6">{children}</ul>;
  if (value.type === 'ordered_list') return <ol className="list-decimal pl-6">{children}</ol>;
  if (value.type === 'list_item') return <li>{children}</li>;
  if (value.type === 'link') { const href = safeHref(value.href); return href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{children}</a> : <>{children}</>; }
  return <>{children}</>;
}

type Breakpoint = 'desktop' | 'tablet' | 'mobile';
type GridPosition = PublishedPanelDocument['sections'][number]['components'][number]['layout'][Breakpoint];

function currentBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.innerWidth < 640) return 'mobile';
  return window.innerWidth < 1024 ? 'tablet' : 'desktop';
}

function usePublishedBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(currentBreakpoint);
  useEffect(() => {
    const update = () => setBreakpoint(currentBreakpoint());
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);
  return breakpoint;
}

function gridStyle(position: GridPosition, rowOffset = 0) {
  const x = Math.max(0, Math.min(11, position.x));
  const width = Math.max(1, Math.min(12 - x, position.w));
  return { gridColumn: `${x + 1} / span ${width}`, gridRow: `${Math.max(0, position.y - rowOffset) + 1} / span ${Math.max(1, position.h)}` };
}

const SELF_SCROLLING = new Set(['kpi_card', 'data_grid', 'geo_map', 'insights', 'bar_chart', 'line_chart', 'donut_chart']);

const EXPANDABLE = new Set(['bar_chart', 'line_chart', 'donut_chart', 'geo_map', 'data_grid', 'insights']);

// These blocks draw their own cards: the cell adds no frame or padding.
const isFrameless = (type: string) => type === 'hero' || type === 'link_cards' || type === 'definition_list' || type === 'report_cards' || type === 'title_bar';

function PublishedGridItem({ component, breakpoint, matrix, title, rowOffset = 0, placed = true, children }: { component: PublishedPanelDocument['sections'][number]['components'][number]; breakpoint: Breakpoint; matrix: boolean; title: string; /** Rows taken by a band lifted above the matrix. */ rowOffset?: number; /** false: drawn inside a panel group, not at its own grid cell. */ placed?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const tight = component.type === 'kpi_card';
  if (!matrix) return <div className={cn('min-w-0', !isFrameless(component.type) && 'rounded-xl border border-border bg-surface shadow-xs', !isFrameless(component.type) && (tight ? 'p-3' : 'p-4'))} style={gridStyle(component.layout[breakpoint])}>{children}</div>;
  // Fixed-matrix cell: the component fills the cell and scrolls or clips inside it; it never stretches the page.
  const bare = component.type === 'heading' || component.type === 'org_brand' || component.type === 'divider';
  // These blocks draw their own cards: the cell adds no frame or padding.
  const frameless = isFrameless(component.type);
  return (
    <div className={cn('group/cell relative flex min-h-0 min-w-0 flex-col rounded-lg', !placed && 'h-full', bare ? 'justify-center' : frameless ? 'overflow-hidden' : 'border border-border bg-surface p-2 shadow-xs', SELF_SCROLLING.has(component.type) || frameless ? 'overflow-hidden' : 'overflow-auto')} style={placed ? gridStyle(component.layout[breakpoint], rowOffset) : undefined}>
      <CellFillProvider value><div className="flex min-h-0 flex-1 flex-col [&>*]:min-h-0">{children}</div></CellFillProvider>
      {EXPANDABLE.has(component.type) && !bare ? (
        <>
          <button type="button" onClick={() => setExpanded(true)} aria-label={`${t('panel.expand')}: ${title}`} title={t('panel.expand')} className="absolute right-1 top-1 z-10 inline-flex size-6 items-center justify-center rounded-md border border-border bg-surface/90 text-text-muted opacity-0 shadow-xs transition-opacity hover:text-text focus-visible:opacity-100 group-hover/cell:opacity-100">
            <ArrowsOutSimple className="size-3.5" aria-hidden="true" />
          </button>
          {expanded ? <Dialog open onOpenChange={setExpanded} title={title || t('panel.expand')} size="xl"><div className="h-[68dvh] min-h-80"><CellFillProvider value><div className="flex h-full min-h-0 flex-col [&>*]:min-h-0">{children}</div></CellFillProvider></div></Dialog> : null}
        </>
      ) : null}
    </div>
  );
}

function storedTableResult(props: Record<string, unknown>, locales: string[]): { result: AnalyticsResult; columns: AnalyticsColumn[] } | null {
  const rawColumns = Array.isArray(props.columns) ? props.columns : null;
  const rawRows = Array.isArray(props.rows) ? props.rows : null;
  if (!rawColumns || !rawRows) return null;
  const columns = rawColumns.flatMap((item): AnalyticsColumn[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const column = item as Record<string, unknown>;
    return typeof column.key === 'string' ? [{ key: column.key, label: localized(column.label, locales) || column.key }] : [];
  });
  if (!columns.length) return null;
  const rows = rawRows.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const row: Record<string, AnalyticsValue> = {};
    for (const column of columns) {
      const value = record[column.key];
      row[column.key] = typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null ? value : null;
    }
    return [row];
  });
  return { columns, result: rows.length ? { state: 'ready', data: { columns, rows } } : { state: 'empty' } };
}

function datasetBinding(bindings?: Record<string, PublishedPanelBinding>): PublishedPanelBinding | null {
  const available = bindings ?? {};
  return Object.keys(available).sort().map((key) => available[key]).find((binding) => binding?.sourceType === 'dataset') ?? null;
}

function localizedLabel(props: Record<string, unknown>, locales: string[], fallback: string): string {
  return localized(props.label, locales) || fallback;
}

function withChartTitle(props: Record<string, unknown>, locales: string[], chart: ReactNode): ReactNode {
  const title = localized(props.title, locales);
  return <div className="flex h-full min-h-0 flex-col gap-1.5">{title ? <h3 className="shrink-0 truncate text-sm font-medium text-text" title={title}>{title}</h3> : null}<div className="min-h-0 flex-1">{chart}</div></div>;
}

const KPI_VARIANTS = new Set(['default', 'primary', 'secondary', 'muted', 'success', 'warning', 'danger']);
function metricPresentation(props: Record<string, unknown>, locales: string[]) {
  const variant = typeof props.variant === 'string' && KPI_VARIANTS.has(props.variant) ? props.variant as 'default' | 'primary' | 'secondary' | 'muted' | 'success' | 'warning' | 'danger' : 'default';
  const locale = locales[0];
  const format = (value: AnalyticsValue) => {
    if (value === null) return '—';
    if (props.format === 'percent' && typeof value === 'number') return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)}%`;
    if (props.format === 'currency' && typeof value === 'number') return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    if ((props.format === 'number' || props.format === 'duration') && typeof value === 'number') return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value);
    return String(value);
  };
  return { variant, format };
}

/** A binding's live state as the chart primitives expect it. The last valid response stays on screen while a newer one loads. */
function resultOf(state: BindingState): AnalyticsResult {
  if (state.response) {
    const columns = state.response.columns.map((column) => ({ key: column.key, label: column.key, align: ['INTEGER', 'DECIMAL', 'NUMBER'].includes(column.type.toUpperCase()) ? 'right' as const : 'left' as const }));
    const rows = analyticsRows(state.response);
    return rows.length ? { state: 'ready', data: { columns, rows } } : { state: 'empty' };
  }
  if (state.status === 'error') return { state: 'error', message: state.error?.message };
  return { state: 'loading' };
}

/**
 * The panel document carries a canonical binding reference, never raw data or a query. CORECROW owns the query and filter
 * authorization; every request goes through the page's shared binding source (cancellation, last-valid-result, one cache).
 * Bar charts may declare a `drill` binding: clicking a bar narrows the dashboard to that category and the chart swaps to the
 * drill binding (e.g. countries -> ports) until the reader goes back.
 */
function PublishedAnalyticsContent({ component, locales }: { component: PublishedPanelDocument['sections'][number]['components'][number]; locales: string[] }) {
  const { t } = useI18n();
  const source = useBindingSource();
  const binding = datasetBinding(component.bindings);
  const categoryField = typeof component.props.categoryKey === 'string' ? component.props.categoryKey : '';
  // A chart that emits selections on its own category keeps listing every category; the selected ones are highlighted instead of the others vanishing.
  const emits = (component.type === 'bar_chart' || component.type === 'donut_chart') && Boolean(source?.toggleFilter && categoryField && source.canFilter?.(categoryField));
  const state = useBindingResult(binding?.sourceId ?? null, {}, emits ? { exceptField: categoryField } : {});
  // A donut may bind a second result named `total` (the page's unique count) to state exact shares and the centre figure.
  const totalBinding = component.type === 'donut_chart' ? bindingIdOf(component.bindings, 'total') : null;
  const totalResult = useBindingResult(totalBinding, {}, emits ? { exceptField: categoryField } : {});
  const drillBinding = component.type === 'bar_chart' ? bindingIdOf(component.bindings, 'drill') : null;
  const drill = component.props.drill && typeof component.props.drill === 'object' ? component.props.drill as { categoryKey?: unknown; title?: unknown } : null;
  const [drilled, setDrilled] = useState<string | null>(null);
  // Until the drill binding has registered its own filter definitions it borrows the chart binding's (same allowlist by contract),
  // so the first drilled request is already narrowed to the clicked category instead of flashing every port.
  const dataFiltersJson = JSON.stringify(source && binding ? source.filtersFor(binding.sourceId) : []);
  const drillOwnJson = JSON.stringify(source && drillBinding ? source.filtersFor(drillBinding) : []);
  const drillRequest = useMemo(() => (drillOwnJson === '[]' ? { filters: JSON.parse(dataFiltersJson) as DatasetQueryFilter[] } : {}), [dataFiltersJson, drillOwnJson]);
  const drillState = useBindingResult(drilled ? drillBinding : null, drillRequest);
  const categoryKey = typeof component.props.categoryKey === 'string' ? component.props.categoryKey : '';
  const selected = source?.selectedValues?.(categoryKey) ?? [];
  // The filter chip was removed elsewhere: the chart returns to its first level.
  useEffect(() => { if (drilled !== null && !selected.some((value) => String(value) === drilled)) setDrilled(null); }, [drilled, selected]);

  // A malformed or future binding type does not fall back to a client query.
  if (!binding) return null;
  // A published document may choose fields only from the response supplied by its server-owned binding. Invalid/missing visual
  // props deliberately fall back to the safe data grid; NORTH never guesses fields or runs a query.
  const availableKeys = new Set(state.response?.columns.map((column) => column.key) ?? []);
  const result = resultOf(state);
  const interactive = Boolean(source?.applyFilter && categoryKey && source.canFilter?.(categoryKey));
  const select = interactive ? (value: string) => (source!.toggleFilter ?? source!.applyFilter!)(categoryKey, value) : undefined;
  const dim = state.refreshing ? 'h-full opacity-60 transition-opacity' : 'h-full';
  if (component.type === 'metric') {
    const field = publishedMetricField(component.props, availableKeys);
    if (field) return <AnalyticsKpi result={result} field={field} label={localizedLabel(component.props, locales, field)} {...metricPresentation(component.props, locales)} />;
  }
  if (component.type === 'bar_chart') {
    const config = publishedBarChartProps(component.props, availableKeys, locales);
    if (config) {
      const title = localized(component.props.title, locales);
      const categoryFormat = component.props.categoryFormat === 'year' || component.props.categoryFormat === 'month' || component.props.categoryFormat === 'monthOfYear' ? component.props.categoryFormat : undefined;
      if (drilled !== null && drillBinding && typeof drill?.categoryKey === 'string') {
        const drillKeys = new Set(drillState.response?.columns.map((column) => column.key) ?? []);
        const drillConfig = publishedBarChartProps({ ...component.props, categoryKey: drill.categoryKey }, new Set([...drillKeys, ...config.series.map((item) => item.key)]), locales);
        const drillTitle = localized(drill.title, locales);
        return (
          <div className="flex h-full min-h-0 flex-col gap-1.5">
            <div className="flex shrink-0 items-center gap-2">
              <button type="button" onClick={() => { source?.clearFilter?.(categoryKey, selected.find((value) => String(value) === drilled) ?? drilled); setDrilled(null); }} className="inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-border px-1.5 text-[11px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text">
                <CaretLeft className="size-3" aria-hidden="true" />{t('panel.drillBack')}
              </button>
              <h3 className="min-w-0 truncate text-sm font-medium text-text" title={`${title} · ${drilled}`}>{drillTitle || title} · {drilled}</h3>
            </div>
            <div className={cn('min-h-0 flex-1', drillState.refreshing && 'opacity-60 transition-opacity')}>{drillConfig ? <AnalyticsBarChart result={resultOf(drillState)} {...drillConfig} categoryFormat={categoryFormat} /> : <AnalyticsBarChart result={resultOf(drillState)} {...config} categoryKey={drill.categoryKey} />}</div>
          </div>
        );
      }
      const canDrill = Boolean(drillBinding) && interactive;
      return (
        <div className="flex h-full min-h-0 flex-col gap-1.5">
          {title ? <h3 className="shrink-0 truncate text-sm font-medium text-text" title={title}>{title}{canDrill ? <span className="ml-2 text-[11px] font-normal text-text-muted">{t('panel.drillHint')}</span> : null}</h3> : null}
          <div className={cn('min-h-0 flex-1', dim)}><AnalyticsBarChart result={result} {...config} categoryFormat={categoryFormat} onSelect={select ? (value) => { const isSelected = selected.some((item) => String(item) === value); select(value); if (canDrill && !isSelected) setDrilled(value); } : undefined} selected={selected.map(String)} /></div>
        </div>
      );
    }
  }
  if (component.type === 'line_chart') {
    const config = publishedLineChartProps(component.props, availableKeys, locales);
    const categoryFormat = component.props.categoryFormat === 'year' || component.props.categoryFormat === 'month' || component.props.categoryFormat === 'monthOfYear' ? component.props.categoryFormat : undefined;
    if (config) return <div className={dim}>{withChartTitle(component.props, locales, <AnalyticsLineAreaChart result={result} {...config} categoryFormat={categoryFormat} />)}</div>;
  }
  if (component.type === 'donut_chart') {
    const config = publishedDonutChartProps(component.props, availableKeys, locales);
    if (config) {
      const totalRow = totalResult.response ? analyticsRows(totalResult.response)[0] : undefined;
      const total = config.totalKey && totalRow ? asNumber(totalRow[config.totalKey]) : null;
      return <div className={dim}>{withChartTitle(component.props, locales, <AnalyticsDonutChart result={result} {...config} total={total} onSelect={select} selected={selected.map(String)} />)}</div>;
    }
  }

  return <AnalyticsDataGrid result={result} />;
}

export function SafeComponent({ type, props, locales }: { type: string; props: Record<string, unknown>; locales: string[] }): ReactNode {
  if (type === 'heading') return <h2 className="font-display text-xl font-semibold">{localized(props.text, locales)}</h2>;
  if (type === 'rich_text') {
    const documents = props.documents as Record<string, unknown> | undefined;
    const document = locales.map((locale) => documents?.[locale]).find(Boolean) ?? Object.values(documents ?? {})[0];
    return <RichNode node={document} />;
  }
  if (type === 'org_brand') return <OrgBrand props={props} />;
  if (type === 'hero') return <HeroBlock props={props} locales={locales} />;
  if (type === 'title_bar') return <TitleBarBlock props={props} locales={locales} />;
  if (type === 'link_cards') return <LinkCardsBlock props={props} locales={locales} />;
  if (type === 'report_cards') return <ReportCardsBlock props={props} locales={locales} />;
  if (type === 'definition_list') return <DefinitionListBlock props={props} locales={locales} />;
  if (type === 'link') {
    if (typeof props.panelSlug === 'string') return <PanelLink slug={props.panelSlug}>{localized(props.label, locales)}</PanelLink>;
    const href = safeHref(props.href); return href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{localized(props.label, locales)}</a> : <span>{localized(props.label, locales)}</span>;
  }
  if (type === 'metric') return <div><p className="text-sm text-text-secondary">{localized(props.label, locales)}</p><p className="text-2xl font-semibold">{String(props.value ?? '—')}</p></div>;
  if (type === 'divider') return <hr className="border-border" />;
  if (type === 'table') { const table = storedTableResult(props, locales); return table ? <AnalyticsDataGrid result={table.result} columns={table.columns} /> : null; }
  if (type === 'list') {
    const items = Array.isArray(props.items) ? props.items : [];
    const List = props.ordered === true ? 'ol' : 'ul';
    return <List className={props.ordered === true ? 'list-decimal pl-6' : 'list-disc pl-6'}>{items.map((item, index) => {
      const value = item as Record<string, unknown>; const href = safeHref(value.href); const label = localized(value.text, locales);
      return <li key={typeof value.id === 'string' ? value.id : index}>{typeof value.panelSlug === 'string' ? <PanelLink slug={value.panelSlug}>{label}</PanelLink> : href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{label}</a> : label}</li>;
    })}</List>;
  }
  if (type === 'card') {
    const title = localized(props.title, locales);
    const body = localized(props.body, locales);
    return <div className="space-y-1"><p className="text-sm font-semibold text-text">{title}</p>{body ? <p className="text-sm leading-6 text-text-secondary">{body}</p> : null}</div>;
  }
  // Assets need authorized signed reads. Unknown schemas fail closed.
  if (['image', 'video', 'file', 'embed'].includes(type)) return <p className="text-sm text-text-muted">Contenido disponible cuando los recursos autorizados estén configurados.</p>;
  return null;
}

function sceneTitle(section: PublishedPanelDocument['sections'][number], locales: string[]): string {
  // A section the author named in the Studio is the scene title; otherwise its first heading.
  const named = localized(section.name, locales);
  if (named) return named;
  const heading = section.components.slice().sort((a, b) => a.order - b.order).find((component) => component.type === 'heading');
  return heading ? localized(heading.props.text, locales) : '';
}

export function PublishedPanel({ title, document, locales, organizationId, panelId }: { title: string; document: PublishedPanelDocument | null; locales: string[]; organizationId: string | null | undefined; panelId: string }) {
  const breakpoint = usePublishedBreakpoint();
  const { t, locale } = useI18n();
  const showcaseSlug = useShowcaseSlug();
  const articleRef = useRef<HTMLElement>(null);
  const [definitionsByBinding, setDefinitionsByBinding] = useState<Record<string, PanelBindingFilterDefinition[]>>({});
  const [selections, setSelections] = useState<FilterSelections>(() => loadSelections(panelId));
  const [executedByBinding, setExecutedByBinding] = useState<Record<string, string>>({});
  // A presentation works on a frozen snapshot of the filters; the dashboard's own selections are never touched by it.
  const [presenting, setPresenting] = useState<FilterSelections | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    setDefinitionsByBinding({});
    setExecutedByBinding({});
    setSelections(loadSelections(panelId));
    setPresenting(null);
  }, [panelId]);
  useEffect(() => {
    const sync = () => setFullscreen(window.document.fullscreenElement === articleRef.current);
    window.document.addEventListener('fullscreenchange', sync);
    return () => window.document.removeEventListener('fullscreenchange', sync);
  }, []);
  const updateSelections = useCallback((next: FilterSelections) => { setSelections(next); saveSelections(panelId, next); }, [panelId]);
  const registerFilterDefinitions = useCallback((bindingId: string, definitions: PanelBindingFilterDefinition[]) => {
    setDefinitionsByBinding((current) => JSON.stringify(current[bindingId] ?? []) === JSON.stringify(definitions) ? current : { ...current, [bindingId]: definitions });
  }, []);
  const registerExecuted = useCallback((bindingId: string, at: string) => {
    setExecutedByBinding((current) => current[bindingId] === at ? current : { ...current, [bindingId]: at });
  }, []);

  // Distinct fields across bindings, in binding order. The control type comes from the definition CORECROW returned.
  const canFacet = !showcaseSlug && Boolean(organizationId);
  // The author may rename filter controls by dataset field key (filter_bar `labels`); the dataset itself is untouched.
  const filterLabels = document?.sections.flatMap((section) => section.components).find((component) => component.type === 'filter_bar')?.props.labels;
  const hiddenFields = useMemo(() => { const raw = document?.sections.flatMap((section) => section.components).find((component) => component.type === 'filter_bar')?.props.hiddenFields; return Array.isArray(raw) ? raw.filter((key): key is string => typeof key === 'string') : []; }, [document]);
  const labelOverrides = useMemo<Record<string, unknown>>(() => (filterLabels && typeof filterLabels === 'object' && !Array.isArray(filterLabels) ? filterLabels as Record<string, unknown> : {}), [filterLabels]);
  const controls = useMemo<FilterControl[]>(() => {
    const byField = new Map<string, FilterControl>();
    // Bindings with the fullest allowlist first so the controls keep the order the author declared.
    for (const bindingId of Object.keys(definitionsByBinding).sort((a, b) => definitionsByBinding[b]!.length - definitionsByBinding[a]!.length || a.localeCompare(b))) for (const definition of definitionsByBinding[bindingId]!) {
      if (byField.has(definition.fieldId)) continue;
      const mode = filterModeOf(definition);
      byField.set(definition.fieldId, { fieldId: definition.fieldId, key: definition.key, label: localized(labelOverrides[definition.key], locales) || localized(definition.displayName, locales) || definition.key, type: definition.type, operators: definition.operators, mode: !canFacet && (mode === 'multi' || mode === 'single') ? 'text' : mode });
    }
    return [...byField.values()];
  }, [canFacet, definitionsByBinding, labelOverrides, locales]);
  // The assistant may ask this dashboard for filters (or to clear them). The request waits until the controls CORECROW
  // described are known, then is applied once through the same selection state a person would use.
  useEffect(() => {
    const apply = () => {
      const request = peekPanelRequest(panelId);
      if (!request) return;
      if (request.kind === 'clear') { consumePanelRequest(request.id); updateSelections({}); return; }
      if (!controls.length) return;
      const { selections: asked } = selectionsFromFilters(request.filters, controls);
      consumePanelRequest(request.id);
      updateSelections(request.replace ? asked : { ...live.current.selections, ...asked });
    };
    apply();
    return subscribePanelRequests(apply);
  }, [controls, panelId, updateSelections]);
  const filtersFor = useCallback((source: FilterSelections) => Object.fromEntries(Object.entries(definitionsByBinding).map(([bindingId, definitions]) => [bindingId, filtersForDefinitions(definitions, source)])) as Record<string, DatasetQueryFilter[]>, [definitionsByBinding]);
  const filtersByBinding = useMemo(() => filtersFor(presenting ?? selections), [filtersFor, presenting, selections]);
  const loadFacet = useCallback<FacetLoader>(async (fieldId, search, offset, signal, granularity) => {
    const entry = Object.entries(definitionsByBinding).find(([, definitions]) => definitions.some((definition) => definition.fieldId === fieldId));
    if (!entry || !organizationId) return { values: [], truncated: false };
    const result = await queryPanelFacet(organizationId, panelId, entry[0], { fieldId, ...(search ? { search } : {}), ...(offset ? { offset } : {}), ...(granularity ? { granularity, limit: 100 } : {}), filters: filtersForDefinitions(entry[1], selections, fieldId) }, signal);
    return { values: result.values, truncated: result.truncated, ...(result.total !== undefined ? { total: result.total } : {}) };
  }, [definitionsByBinding, organizationId, panelId, selections]);

  // One source for every analytics component on the page: same filters, same refresh, same CORECROW contract.
  // The object is stable (identity never changes while the panel is open) and reads the live state through a ref, so
  // a filter change refetches only the bindings whose own filters changed instead of the whole page.
  const live = useRef({ filtersByBinding, version, selections, controls, canFacet, definitions: definitionsByBinding, effective: presenting ?? selections });
  live.current = { filtersByBinding, version, selections, controls, canFacet, definitions: definitionsByBinding, effective: presenting ?? selections };
  const bindingSource = useMemo<BindingSource>(() => ({
    get version() { return live.current.version; },
    filtersFor: (bindingId, exceptFieldId) => (exceptFieldId ? filtersForDefinitions(live.current.definitions[bindingId] ?? [], live.current.effective, exceptFieldId) : live.current.filtersByBinding[bindingId] ?? []),
    fetch: async (bindingId, request, signal) => {
      if (!organizationId) throw new Error('No organization');
      const { filters = [], ...options } = request;
      const response = showcaseSlug
        ? await queryShowcaseBinding(showcaseSlug, panelId, bindingId, filters, signal)
        : await queryPanelAnalyticsBinding(organizationId, panelId, bindingId, filters, signal, live.current.version > 0 ? { ...options, fresh: true } : options);
      return response as BindingResponse;
    },
    report: (bindingId, response) => {
      if (response.filterDefinitions) registerFilterDefinitions(bindingId, response.filterDefinitions);
      registerExecuted(bindingId, response.executedAt);
    },
    canFilter: (fieldId) => live.current.canFacet && live.current.controls.some((control) => control.fieldId === fieldId && (control.mode === 'multi' || control.mode === 'single')),
    selectedValues: (fieldId) => live.current.selections[fieldId]?.values ?? [],
    clearFilter: (fieldId, value) => {
      const { selections: current } = live.current;
      const remaining = (current[fieldId]?.values ?? []).filter((item) => item !== value);
      const rest = { ...current };
      delete rest[fieldId];
      updateSelections(remaining.length || current[fieldId]?.text || current[fieldId]?.from || current[fieldId]?.to ? { ...rest, [fieldId]: { ...current[fieldId], values: remaining } } : rest);
    },
    toggleFilter: (fieldId, value) => {
      const { selections: current } = live.current;
      const values = current[fieldId]?.values ?? [];
      if (!values.includes(value)) { updateSelections({ ...current, [fieldId]: { ...current[fieldId], values: [...values, value] } }); return; }
      const remaining = values.filter((item) => item !== value);
      const rest = { ...current };
      delete rest[fieldId];
      const kept = current[fieldId]!;
      updateSelections(remaining.length || kept.text || kept.from || kept.to ? { ...rest, [fieldId]: { ...kept, values: remaining } } : rest);
    },
    applyFilter: (fieldId, value) => {
      const { selections: current } = live.current;
      const values = current[fieldId]?.values ?? [];
      updateSelections({ ...current, [fieldId]: { ...current[fieldId], values: values.includes(value) ? values : [...values, value] } });
    },
  }), [organizationId, panelId, registerExecuted, registerFilterDefinitions, showcaseSlug, updateSelections]);

  if (!document) return <div className="p-6 text-sm text-text-muted">{t('panel.noContent')}</div>;
  const sections = document.sections.slice().sort((a, b) => a.order - b.order);
  // A section with `rowHeight` is a fixed matrix on desktop/tablet: every row is that tall, components fill their cells and
  // scroll inside them. With `fit` (desktop) the rows stretch to the viewport but never shrink below `rowHeight`.
  const GAP_PX = { none: 0, sm: 8, md: 16, lg: 24 } as const;
  const groupedIds = (section: (typeof sections)[number]) => new Set(section.components.flatMap((component) => component.type === 'panel_group' && Array.isArray(component.props.items) ? (component.props.items as Array<{ componentId?: unknown }>).flatMap((item) => (typeof item.componentId === 'string' ? [item.componentId] : [])) : []));
  const matrixOf = (section: (typeof sections)[number]) => {
    const rowHeight = breakpoint === 'desktop' ? section.layout.rowHeight : undefined;
    if (!rowHeight) return null;
    const grouped = groupedIds(section);
    const bottom = (component: (typeof section.components)[number]) => component.layout[breakpoint].y + component.layout[breakpoint].h;
    const fit = section.layout.fit === true;
    // With `fit`, the filter bar leaves the matrix and takes the height ITS CONTENT needs (one or two lines), so the body rows get the rest.
    const band = fit ? Math.max(0, ...section.components.filter((component) => component.type === 'filter_bar').map(bottom)) : 0;
    const rows = Math.max(1, Math.max(...section.components.filter((component) => !grouped.has(component.id) && component.type !== 'filter_bar').map(bottom), 0) - band);
    return { rowHeight, rows, fit, band };
  };
  const filterTitle = localized(sections.flatMap((section) => section.components).find((component) => component.type === 'filter_bar')?.props.title, locales) || undefined;
  const hasFilterSlot = sections.some((section) => section.components.some((component) => component.type === 'filter_bar'));
  const filterBar = <FilterBar controls={controls} selections={selections} onChange={updateSelections} loadFacet={canFacet ? loadFacet : undefined} title={filterTitle} hiddenKeys={hiddenFields} compact={sections.some((section) => matrixOf(section) !== null)} />;
  const fitted = sections.some((section) => matrixOf(section)?.fit);
  const renderSection = (section: (typeof sections)[number]) => {
    const matrix = matrixOf(section);
    const ordered = section.components.slice().sort((a, b) => a.order - b.order);
    const byId = new Map(ordered.map((component) => [component.id, component]));
    const grouped = groupedIds(section);
    const lifted = Boolean(matrix?.fit && matrix.band > 0);
    // A title bar placed above the filter bar belongs to the lifted band: it is drawn right above the filters, outside the fixed matrix.
    const filterTop = Math.min(...ordered.filter((component) => component.type === 'filter_bar').map((component) => component.layout[breakpoint].y), Infinity);
    const bandBars = lifted ? ordered.filter((component) => component.type === 'title_bar' && component.layout[breakpoint].y < filterTop) : [];
    const inBand = new Set(bandBars.map((component) => component.id));
    const contentOf = (component: (typeof ordered)[number]): ReactNode => {
      const binding = datasetBinding(component.bindings);
      if (component.type === 'panel_group') return <PanelGroup props={component.props} locales={locales} render={(id) => { const member = byId.get(id); const inner = member ? contentOf(member) : null; return member && inner !== null ? <PublishedGridItem component={member} breakpoint={breakpoint} matrix title={localized(member.props.title, locales)} placed={false}>{inner}</PublishedGridItem> : null; }} />;
      return PRO_TYPES.has(component.type)
        ? <ProComponent component={component} panelKey={panelId} locales={locales} />
        : binding
        ? <PublishedAnalyticsContent component={component} locales={locales} />
        : component.type === 'document_workspace'
          ? <DocumentWorkspaceHost organizationId={organizationId} props={component.props} />
          : SafeComponent({ type: component.type, props: component.props, locales });
    };
    const style = matrix ? {
      gridTemplateRows: `repeat(${matrix.rows}, ${matrix.fit ? `minmax(${matrix.rowHeight}px, 1fr)` : `${matrix.rowHeight}px`})`,
      ...(matrix.fit ? { minHeight: matrix.rows * matrix.rowHeight + (matrix.rows - 1) * GAP_PX[section.layout.gap] } : {}),
    } : undefined;
    return <Fragment key={section.id}>
      {lifted && bandBars.length ? <div className="shrink-0 space-y-2">{bandBars.map((component) => <div key={component.id}>{SafeComponent({ type: component.type, props: component.props, locales })}</div>)}</div> : null}
      {lifted && !presenting ? <div className="shrink-0">{filterBar}</div> : null}
      <section style={style} className={cn('grid grid-cols-12', !matrix && 'auto-rows-[minmax(2rem,auto)]', GAP[section.layout.gap], matrix?.fit && 'min-h-0 flex-1')}>{ordered.filter((component) => !grouped.has(component.id) && !inBand.has(component.id)).map((component) => {
        // The filter bar placed by the author is live on the page and absent from presentation scenes (those use a frozen snapshot).
        if (component.type === 'filter_bar') return lifted || presenting ? null : <div key={component.id} className={cn('min-w-0', matrix && 'min-h-0')} style={gridStyle(component.layout[breakpoint])}>{filterBar}</div>;
        const content = contentOf(component);
        return content === null ? null : <PublishedGridItem key={component.id} component={component} breakpoint={breakpoint} matrix={matrix !== null} rowOffset={matrix?.band ?? 0} title={localized(component.props.title, locales)}>{content}</PublishedGridItem>;
      })}</section>
    </Fragment>;
  };
  const updatedAt = Object.values(executedByBinding).sort().at(-1) ?? null;
  const toggleFullscreen = () => {
    if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => {});
    else void articleRef.current?.requestFullscreen().catch(() => {});
  };
  const toolbarButton = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-secondary transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min)';

  return <BindingSourceProvider source={bindingSource}><article ref={articleRef} className={cn('north-enter mx-auto w-full max-w-[1680px]', fitted ? 'flex h-full flex-col gap-2 p-2 lg:p-3' : 'space-y-5 p-4 lg:p-5', fullscreen && 'max-w-none overflow-auto bg-background')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className={cn('font-display font-semibold', fitted ? 'text-lg' : 'text-2xl')}>{title}</h1>
      <div className="flex items-center gap-2">
        {updatedAt ? <span className="mr-1 hidden text-right text-[11px] leading-tight text-text-muted sm:block"><span className="block">{t('pres.updated')}</span><span className="block tabular-nums text-text-secondary">{new Intl.DateTimeFormat(intlTag(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(updatedAt))}</span></span> : null}
        <button type="button" className={toolbarButton} onClick={() => setVersion((value) => value + 1)}><ArrowsClockwise className="size-3.5" aria-hidden="true" />{t('panel.refresh')}</button>
        {sections.length > 0 ? <button type="button" className={toolbarButton} onClick={() => setPresenting(selections)}><Presentation className="size-3.5" aria-hidden="true" />{t('pres.start')}</button> : null}
        {window.document.fullscreenEnabled ? <button type="button" className={toolbarButton} onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen ? <ArrowsIn className="size-3.5" aria-hidden="true" /> : <ArrowsOut className="size-3.5" aria-hidden="true" />}{fullscreen ? t('pres.exitFullscreen') : t('pres.fullscreen')}</button> : null}
      </div>
    </div>
    {hasFilterSlot ? null : filterBar}
    {presenting ? null : sections.map(renderSection)}
    {presenting ? <PresentationMode
      title={title}
      scenes={sections.map((section, index) => ({ id: section.id, title: sceneTitle(section, locales) || t('pres.scene', { n: index + 1 }), content: renderSection(section) }))}
      filterSummary={chipsOf(controls, presenting).map((chip) => chip.text)}
      updatedAt={updatedAt}
      onExit={() => setPresenting(null)}
    /> : null}
  </article></BindingSourceProvider>;
}

/** Gives internal links (`panelSlug`) the shell's navigation: resolves the target in the catalog and opens it like the sidebar would. */
function PanelNavigationBridge({ children }: { children: ReactNode }) {
  const { categories } = useCatalog();
  const { activeOrganization } = useOrganization();
  const { navigate } = useTabs();
  const open = useCallback((panelSlug: string) => {
    for (const category of categories) {
      const subcategory = category.subcategories.find((item) => item.publishedPanels?.some((panel) => panel.slug === panelSlug));
      if (subcategory) { void navigateToPublishedTarget({ organizationSlug: activeOrganization?.slug, category, subcategory, navigate, history: 'push', panelSlug }).catch(() => undefined); return; }
    }
  }, [activeOrganization?.slug, categories, navigate]);
  return <PanelNavigationContext.Provider value={open}>{children}</PanelNavigationContext.Provider>;
}

export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  const { t } = useI18n();
  const { getCategory, getSubcategory, isLoading: catalogLoading } = useCatalog();
  const { activeOrganization } = useOrganization();
  // Keep the shell stable while the catalog resolves: only this region shows a quiet skeleton.
  if (!tab && catalogLoading) return <div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  if (!tab) return <div className="flex flex-1 items-center justify-center text-sm text-text-muted">{t('panel.selectCategory')}</div>;
  const category = getCategory(tab.route.categoryId);
  const subcategory = getSubcategory(tab.route.categoryId, tab.route.subcategoryId);
  if (activeOrganization && category?.slug === 'admin') {
    return (
      <Suspense fallback={<div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div>}>
        <AdminCenter section={adminSectionOf(subcategory) ?? 'overview'} organizationId={activeOrganization.id} currentUserId={user.id} />
      </Suspense>
    );
  }
  // The system Home is implementation-backed (it has no stored document): an organization renders its own Home for it.
  // An edited Home (a published document) is rendered like any panel; the built-in Home is only the fallback while there is none.
  if (activeOrganization && activeOrganization.id !== PERSONAL_ORG_ID && category?.slug === 'home' && !tab.publishedPanel?.document) return <OrganizationHome user={user} />;
  if (tab.publishedPanel) return <PanelNavigationBridge><PublishedPanel key={tab.publishedPanel.id} title={tab.publishedPanel.title} document={tab.publishedPanel.document} locales={tab.publishedPanel.localeOrder} organizationId={activeOrganization?.id} panelId={tab.publishedPanel.id} /></PanelNavigationBridge>;
  if (PERSONAL_CATEGORIES.has(tab.route.categoryId)) return <PersonalView route={tab.route} user={user} />;
  return <div className="p-6"><EmptyState icon={Barricade} title={t('panel.underConstruction')} body={t('panel.underConstructionBody', { name: tab.route.categoryId })} className="max-w-md" /></div>;
}
