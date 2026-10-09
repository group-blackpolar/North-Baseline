import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Barricade } from '@phosphor-icons/react';
import type { SessionUser } from '@/lib/auth';
import type { Tab } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { SharkView } from '@/features/shark/SharkView';
import { adminSectionOf } from '@/features/admin-center/sections';
import { PersonalView } from '@/features/personal/PersonalView';
import { AnalyticsBarChart, AnalyticsDataGrid, AnalyticsDonutChart, AnalyticsFilterControls, AnalyticsKpi, AnalyticsLineAreaChart } from '@/features/analytics/AnalyticsVisuals';
import type { AnalyticsColumn, AnalyticsFilter, AnalyticsResult, AnalyticsValue } from '@/features/analytics/types';
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

// Administration is the largest authenticated surface and most sessions never open it: load it on demand.
const AdminCenter = lazy(() => import('@/features/admin-center/AdminCenter').then((module) => ({ default: module.AdminCenter })));

const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences', 'settings']);
const SHARK_CATEGORIES = new Set(['shark-home', 'master-house']);
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
}: {
  component: PublishedPanelDocument['sections'][number]['components'][number];
  organizationId: string | null | undefined;
  panelId: string;
  locales: string[];
  filters: DatasetQueryFilter[];
  onFilterDefinitions: (bindingId: string, definitions: PanelBindingFilterDefinition[]) => void;
}) {
  const binding = datasetBinding(component.bindings);
  const { result, response } = usePanelBindingQuery(organizationId, panelId, binding?.sourceId, filters);
  useEffect(() => {
    if (binding && response) onFilterDefinitions(binding.sourceId, response.filterDefinitions);
  }, [binding, onFilterDefinitions, response]);

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

const FILTER_OPERATOR_LABEL: Record<DatasetQueryFilter['operator'], string> = { EQ: '=', NE: '≠', GT: '>', GTE: '≥', LT: '<', LTE: '≤', CONTAINS: '∋' };

export function PublishedPanel({ title, document, locales, organizationId, panelId }: { title: string; document: PublishedPanelDocument | null; locales: string[]; organizationId: string | null | undefined; panelId: string }) {
  const breakpoint = usePublishedBreakpoint();
  const { t } = useI18n();
  const [definitionsByBinding, setDefinitionsByBinding] = useState<Record<string, PanelBindingFilterDefinition[]>>({});
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [filtersByBinding, setFiltersByBinding] = useState<Record<string, DatasetQueryFilter[]>>({});
  useEffect(() => {
    setDefinitionsByBinding({});
    setDraftValues({});
    setFiltersByBinding({});
  }, [panelId]);
  const registerFilterDefinitions = useCallback((bindingId: string, definitions: PanelBindingFilterDefinition[]) => {
    setDefinitionsByBinding((current) => JSON.stringify(current[bindingId] ?? []) === JSON.stringify(definitions) ? current : { ...current, [bindingId]: definitions });
  }, []);
  const filterDefinitions = useMemo(() => {
    const unique = new Map<string, { definition: PanelBindingFilterDefinition; operator: DatasetQueryFilter['operator'] }>();
    for (const definitions of Object.values(definitionsByBinding)) for (const definition of definitions) {
      for (const operator of definition.operators) unique.set(`${definition.fieldId}:${operator}`, { definition, operator });
    }
    return [...unique.entries()];
  }, [definitionsByBinding]);
  const filterControls = useMemo<AnalyticsFilter[]>(() => filterDefinitions.map(([id, { definition, operator }]) => {
    const type = definition.type === 'DATE' ? 'date' : definition.type === 'BOOLEAN' ? 'select' : 'text';
    return {
      id,
      label: `${localized(definition.displayName, locales) || definition.key} ${FILTER_OPERATOR_LABEL[operator]}`,
      type,
      value: draftValues[id] ?? '',
      ...(definition.type === 'BOOLEAN' ? { options: [{ value: 'true', label: t('analytics.true') }, { value: 'false', label: t('analytics.false') }] } : {}),
    };
  }), [draftValues, filterDefinitions, locales, t]);
  const applyFilters = () => {
    setFiltersByBinding(Object.fromEntries(Object.entries(definitionsByBinding).map(([bindingId, definitions]) => [bindingId, definitions.flatMap((definition) => definition.operators.flatMap((operator): DatasetQueryFilter[] => {
        const value = draftValues[`${definition.fieldId}:${operator}`];
        if (value === undefined || value === '') return [];
        return [{ fieldId: definition.fieldId, operator, value: definition.type === 'BOOLEAN' ? value === 'true' : value }];
      }))])));
  };
  const clearFilters = () => { setDraftValues({}); setFiltersByBinding({}); };
  if (!document) return <div className="p-6 text-sm text-text-muted">Este panel publicado no tiene contenido disponible.</div>;
  return <article className="north-enter mx-auto w-full max-w-[1680px] space-y-5 p-4 lg:p-5"><h1 className="font-display text-2xl font-semibold">{title}</h1>{filterControls.length ? <div className="space-y-2"><AnalyticsFilterControls filters={filterControls} onChange={(id, value) => setDraftValues((current) => ({ ...current, [id]: Array.isArray(value) ? value[0] ?? '' : value }))} /><div className="flex justify-end gap-2"><button type="button" onClick={clearFilters} className="h-8 rounded-md border border-border px-3 text-xs text-text-secondary hover:bg-surface-hover">{t('analytics.clearFilters')}</button><button type="button" onClick={applyFilters} className="h-8 rounded-md bg-accent px-3 text-xs font-medium text-white hover:opacity-90">{t('analytics.applyFilters')}</button></div></div> : null}{document.sections.slice().sort((a, b) => a.order - b.order).map((section) => <section key={section.id} className={`grid grid-cols-12 auto-rows-[minmax(2rem,auto)] ${GAP[section.layout.gap]}`}>{section.components.slice().sort((a, b) => a.order - b.order).map((component) => {
    const content = datasetBinding(component.bindings)
      ? <PublishedAnalyticsContent component={component} organizationId={organizationId} panelId={panelId} locales={locales} filters={filtersByBinding[datasetBinding(component.bindings)!.sourceId] ?? []} onFilterDefinitions={registerFilterDefinitions} />
      : component.type === 'document_workspace'
        ? <DocumentWorkspaceHost organizationId={organizationId} props={component.props} />
        : SafeComponent({ type: component.type, props: component.props, locales });
    return content === null ? null : <PublishedGridItem key={component.id} component={component} breakpoint={breakpoint}>{content}</PublishedGridItem>;
  })}</section>)}</article>;
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
  if (SHARK_CATEGORIES.has(tab.route.categoryId)) return <SharkView route={tab.route} />;
  return <div className="p-6"><EmptyState icon={Barricade} title="Vista en construcción" body={`La categoría "${tab.route.categoryId}" está siendo preparada.`} className="max-w-md" /></div>;
}
