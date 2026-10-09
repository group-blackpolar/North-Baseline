import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowsIn, ArrowsOut, Barricade, Presentation } from '@phosphor-icons/react';
import type { SessionUser } from '@/lib/auth';
import type { Tab } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { adminSectionOf } from '@/features/admin-center/sections';
import { PersonalView } from '@/features/personal/PersonalView';
import { AnalyticsBarChart, AnalyticsDataGrid, AnalyticsDonutChart, AnalyticsKpi, AnalyticsLineAreaChart } from '@/features/analytics/AnalyticsVisuals';
import type { AnalyticsColumn, AnalyticsResult, AnalyticsValue } from '@/features/analytics/types';
import type { DatasetQueryFilter } from '@/features/analytics/datasetQuery';
import type { PanelBindingFilterDefinition } from '@/features/analytics/panelBindingQuery';
import { usePanelBindingQuery } from '@/features/analytics/usePanelBindingQuery';
import { publishedBarChartProps, publishedDonutChartProps, publishedLineChartProps, publishedMetricField } from '@/features/analytics/publishedVisualProps';
import type { PublishedPanelBinding, PublishedPanelDocument } from '@/lib/organizations';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useI18n } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { DocumentWorkspaceHost } from '@/features/documents/DocumentsWorkspace';
import { useShowcaseSlug } from '@/features/showcase/ShowcaseContext';
import { FilterBar, type FacetLoader, type FilterControl } from '@/features/filters/FilterBar';
import { queryPanelFacet } from '@/features/filters/facetsApi';
import { chipsOf, filterModeOf, filtersForDefinitions, loadSelections, saveSelections, type FilterSelections } from '@/features/filters/filterModel';
import { PresentationMode } from '@/features/presentation/PresentationMode';
import { cn } from '@/lib/utils';

// Administration is the largest authenticated surface and most sessions never open it: load it on demand.
const AdminCenter = lazy(() => import('@/features/admin-center/AdminCenter').then((module) => ({ default: module.AdminCenter })));

const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences', 'settings']);
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

function gridStyle(position: GridPosition) {
  const x = Math.max(0, Math.min(11, position.x));
  const width = Math.max(1, Math.min(12 - x, position.w));
  return { gridColumn: `${x + 1} / span ${width}`, gridRow: `${Math.max(0, position.y) + 1} / span ${Math.max(1, position.h)}` };
}

function PublishedGridItem({ component, breakpoint, children }: { component: PublishedPanelDocument['sections'][number]['components'][number]; breakpoint: Breakpoint; children: ReactNode }) {
  return <div className="min-w-0 rounded-xl border border-border bg-surface p-4" style={gridStyle(component.layout[breakpoint])}>{children}</div>;
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
  return <div className="space-y-2">{title ? <h3 className="text-sm font-medium text-text">{title}</h3> : null}{chart}</div>;
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

/**
 * The panel document carries a canonical binding reference, never raw data or
 * a query. CORECROW owns the query and filter authorization for this request.
 */
function PublishedAnalyticsContent({
  component,
  organizationId,
  panelId,
  locales,
  filters,
  onFilterDefinitions,
  onExecuted,
}: {
  component: PublishedPanelDocument['sections'][number]['components'][number];
  organizationId: string | null | undefined;
  panelId: string;
  locales: string[];
  filters: DatasetQueryFilter[];
  onFilterDefinitions: (bindingId: string, definitions: PanelBindingFilterDefinition[]) => void;
  onExecuted: (bindingId: string, executedAt: string) => void;
}) {
  const binding = datasetBinding(component.bindings);
  const { result, response } = usePanelBindingQuery(organizationId, panelId, binding?.sourceId, filters);
  useEffect(() => {
    if (binding && response) {
      onFilterDefinitions(binding.sourceId, response.filterDefinitions);
      onExecuted(binding.sourceId, response.executedAt);
    }
  }, [binding, onExecuted, onFilterDefinitions, response]);

  // A malformed or future binding type does not fall back to a client query.
  if (!binding) return null;
  // A published document may choose fields only from the response supplied by
  // its server-owned binding. Invalid/missing visual props deliberately fall
  // back to the safe data grid; NORTH never guesses fields or runs a query.
  const availableKeys = new Set(response?.columns.map((column) => column.key) ?? []);
  if (component.type === 'metric') {
    const field = publishedMetricField(component.props, availableKeys);
    if (field) return <AnalyticsKpi result={result} field={field} label={localizedLabel(component.props, locales, field)} {...metricPresentation(component.props, locales)} />;
  }
  if (component.type === 'bar_chart') {
    const config = publishedBarChartProps(component.props, availableKeys, locales);
    if (config) return withChartTitle(component.props, locales, <AnalyticsBarChart result={result} {...config} />);
  }
  if (component.type === 'line_chart') {
    const config = publishedLineChartProps(component.props, availableKeys, locales);
    if (config) return withChartTitle(component.props, locales, <AnalyticsLineAreaChart result={result} {...config} />);
  }
  if (component.type === 'donut_chart') {
    const config = publishedDonutChartProps(component.props, availableKeys);
    if (config) return withChartTitle(component.props, locales, <AnalyticsDonutChart result={result} {...config} />);
  }

  return <AnalyticsDataGrid result={result} />;
}

function SafeComponent({ type, props, locales }: { type: string; props: Record<string, unknown>; locales: string[] }): ReactNode {
  if (type === 'heading') return <h2 className="font-display text-xl font-semibold">{localized(props.text, locales)}</h2>;
  if (type === 'rich_text') {
    const documents = props.documents as Record<string, unknown> | undefined;
    const document = locales.map((locale) => documents?.[locale]).find(Boolean) ?? Object.values(documents ?? {})[0];
    return <RichNode node={document} />;
  }
  if (type === 'link') { const href = safeHref(props.href); return href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{localized(props.label, locales)}</a> : <span>{localized(props.label, locales)}</span>; }
  if (type === 'metric') return <div><p className="text-sm text-text-secondary">{localized(props.label, locales)}</p><p className="text-2xl font-semibold">{String(props.value ?? '—')}</p></div>;
  if (type === 'divider') return <hr className="border-border" />;
  if (type === 'table') { const table = storedTableResult(props, locales); return table ? <AnalyticsDataGrid result={table.result} columns={table.columns} /> : null; }
  if (type === 'list') {
    const items = Array.isArray(props.items) ? props.items : [];
    const List = props.ordered === true ? 'ol' : 'ul';
    return <List className={props.ordered === true ? 'list-decimal pl-6' : 'list-disc pl-6'}>{items.map((item, index) => {
      const value = item as Record<string, unknown>; const href = safeHref(value.href); const label = localized(value.text, locales);
      return <li key={typeof value.id === 'string' ? value.id : index}>{href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{label}</a> : label}</li>;
    })}</List>;
  }
  // Assets need authorized signed reads. Unknown schemas fail closed.
  if (['image', 'video', 'file', 'card', 'embed'].includes(type)) return <p className="text-sm text-text-muted">Contenido disponible cuando los recursos autorizados estén configurados.</p>;
  return null;
}

function sceneTitle(section: PublishedPanelDocument['sections'][number], locales: string[]): string {
  const heading = section.components.slice().sort((a, b) => a.order - b.order).find((component) => component.type === 'heading');
  return heading ? localized(heading.props.text, locales) : '';
}

export function PublishedPanel({ title, document, locales, organizationId, panelId }: { title: string; document: PublishedPanelDocument | null; locales: string[]; organizationId: string | null | undefined; panelId: string }) {
  const breakpoint = usePublishedBreakpoint();
  const { t } = useI18n();
  const showcaseSlug = useShowcaseSlug();
  const articleRef = useRef<HTMLElement>(null);
  const [definitionsByBinding, setDefinitionsByBinding] = useState<Record<string, PanelBindingFilterDefinition[]>>({});
  const [selections, setSelections] = useState<FilterSelections>(() => loadSelections(panelId));
  const [executedByBinding, setExecutedByBinding] = useState<Record<string, string>>({});
  // A presentation works on a frozen snapshot of the filters; the dashboard's own selections are never touched by it.
  const [presenting, setPresenting] = useState<FilterSelections | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
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
  const controls = useMemo<FilterControl[]>(() => {
    const byField = new Map<string, FilterControl>();
    for (const bindingId of Object.keys(definitionsByBinding).sort()) for (const definition of definitionsByBinding[bindingId]!) {
      if (byField.has(definition.fieldId)) continue;
      const mode = filterModeOf(definition);
      byField.set(definition.fieldId, { fieldId: definition.fieldId, label: localized(definition.displayName, locales) || definition.key, type: definition.type, operators: definition.operators, mode: !canFacet && (mode === 'multi' || mode === 'single') ? 'text' : mode });
    }
    return [...byField.values()];
  }, [canFacet, definitionsByBinding, locales]);
  const filtersFor = useCallback((source: FilterSelections) => Object.fromEntries(Object.entries(definitionsByBinding).map(([bindingId, definitions]) => [bindingId, filtersForDefinitions(definitions, source)])) as Record<string, DatasetQueryFilter[]>, [definitionsByBinding]);
  const filtersByBinding = useMemo(() => filtersFor(presenting ?? selections), [filtersFor, presenting, selections]);
  const loadFacet = useCallback<FacetLoader>(async (fieldId, search, signal) => {
    const entry = Object.entries(definitionsByBinding).find(([, definitions]) => definitions.some((definition) => definition.fieldId === fieldId));
    if (!entry || !organizationId) return { values: [], truncated: false };
    const result = await queryPanelFacet(organizationId, panelId, entry[0], { fieldId, ...(search ? { search } : {}), filters: filtersForDefinitions(entry[1], selections, fieldId) }, signal);
    return { values: result.values, truncated: result.truncated };
  }, [definitionsByBinding, organizationId, panelId, selections]);

  if (!document) return <div className="p-6 text-sm text-text-muted">Este panel publicado no tiene contenido disponible.</div>;
  const sections = document.sections.slice().sort((a, b) => a.order - b.order);
  const renderSection = (section: (typeof sections)[number]) => <section key={section.id} className={`grid grid-cols-12 auto-rows-[minmax(2rem,auto)] ${GAP[section.layout.gap]}`}>{section.components.slice().sort((a, b) => a.order - b.order).map((component) => {
    const binding = datasetBinding(component.bindings);
    const content = binding
      ? <PublishedAnalyticsContent component={component} organizationId={organizationId} panelId={panelId} locales={locales} filters={filtersByBinding[binding.sourceId] ?? []} onFilterDefinitions={registerFilterDefinitions} onExecuted={registerExecuted} />
      : component.type === 'document_workspace'
        ? <DocumentWorkspaceHost organizationId={organizationId} props={component.props} />
        : SafeComponent({ type: component.type, props: component.props, locales });
    return content === null ? null : <PublishedGridItem key={component.id} component={component} breakpoint={breakpoint}>{content}</PublishedGridItem>;
  })}</section>;
  const updatedAt = Object.values(executedByBinding).sort().at(-1) ?? null;
  const toggleFullscreen = () => {
    if (window.document.fullscreenElement) void window.document.exitFullscreen().catch(() => {});
    else void articleRef.current?.requestFullscreen().catch(() => {});
  };
  const toolbarButton = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-text-secondary transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 pointer-coarse:h-(--touch-min)';

  return <article ref={articleRef} className={cn('north-enter mx-auto w-full max-w-[1680px] space-y-5 p-4 lg:p-5', fullscreen && 'max-w-none overflow-auto bg-background')}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-display text-2xl font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        {sections.length > 0 ? <button type="button" className={toolbarButton} onClick={() => setPresenting(selections)}><Presentation className="size-3.5" aria-hidden="true" />{t('pres.start')}</button> : null}
        {window.document.fullscreenEnabled ? <button type="button" className={toolbarButton} onClick={toggleFullscreen} aria-pressed={fullscreen}>{fullscreen ? <ArrowsIn className="size-3.5" aria-hidden="true" /> : <ArrowsOut className="size-3.5" aria-hidden="true" />}{fullscreen ? t('pres.exitFullscreen') : t('pres.fullscreen')}</button> : null}
      </div>
    </div>
    <FilterBar controls={controls} selections={selections} onChange={updateSelections} loadFacet={canFacet ? loadFacet : undefined} />
    {presenting ? null : sections.map(renderSection)}
    {presenting ? <PresentationMode
      title={title}
      scenes={sections.map((section, index) => ({ id: section.id, title: sceneTitle(section, locales) || t('pres.scene', { n: index + 1 }), content: renderSection(section) }))}
      filterSummary={chipsOf(controls, presenting).map((chip) => chip.text)}
      updatedAt={updatedAt}
      onExit={() => setPresenting(null)}
    /> : null}
  </article>;
}

export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  const { getCategory, getSubcategory, isLoading: catalogLoading } = useCatalog();
  const { activeOrganization } = useOrganization();
  // Keep the shell stable while the catalog resolves: only this region shows a quiet skeleton.
  if (!tab && catalogLoading) return <div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  if (!tab) return <div className="flex flex-1 items-center justify-center text-sm text-text-muted">Selecciona una categoría para comenzar</div>;
  const category = getCategory(tab.route.categoryId);
  const subcategory = getSubcategory(tab.route.categoryId, tab.route.subcategoryId);
  if (activeOrganization && category?.slug === 'admin') {
    return (
      <Suspense fallback={<div className="w-full space-y-3 p-4 lg:p-5" aria-busy="true"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div>}>
        <AdminCenter section={adminSectionOf(subcategory) ?? 'overview'} organizationId={activeOrganization.id} currentUserId={user.id} />
      </Suspense>
    );
  }
  if (tab.publishedPanel) return <PublishedPanel title={tab.publishedPanel.title} document={tab.publishedPanel.document} locales={tab.publishedPanel.localeOrder} organizationId={activeOrganization?.id} panelId={tab.publishedPanel.id} />;
  if (PERSONAL_CATEGORIES.has(tab.route.categoryId)) return <PersonalView route={tab.route} user={user} />;
  return <div className="p-6"><EmptyState icon={Barricade} title="Vista en construcción" body={`La categoría "${tab.route.categoryId}" está siendo preparada.`} className="max-w-md" /></div>;
}
