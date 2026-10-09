import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowsClockwise, BookmarkSimple, CaretRight, Database, FileText, FolderSimplePlus, Funnel, MagnifyingGlass, PencilSimpleLine, Plus, SidebarSimple, Stack, Tree, Warning, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Icon, type IconComponent } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { useNotifications } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { resolvePublishedPanel } from '@/lib/organizations';
import { publishedTabFromResolved } from '@/lib/publishedNavigation';
import { pushPath } from '@/lib/routes';
import { useElementWidth } from '@/lib/useElementWidth';
import { cn } from '@/lib/utils';
import { listMembers } from '@/features/access-admin/api';
import { listAuditEntries, listDatasets } from '@/features/admin-center/api';
import { useResource } from '@/features/admin-center/hooks';
import { useAdminNavigation } from '@/features/admin-center/navigation';
import { useViewsEditor } from '../ViewsEditorContext';
import { FilterChips, FilterPanel } from './FilterPanel';
import { ResourceInspector } from './ResourceInspector';
import { ResultsPane, formatWhen, type DisplayMode } from './ResultsPane';
import { StructureExplorer } from './StructureExplorer';
import { activeFilterCount, detectHealth, flattenTree, localName, queryResources, summarize, emptyFilters, type GroupBy, type TreeCategory, type ViewFilters, type ViewResource } from './resources';
import { useRevisionInfo, useSavedFilters, useViewFilters } from './useViewsWorkspace';
import { useViewActions } from './useViewActions';

const MODE_KEY = 'north-views-display';

function readMode(): DisplayMode {
  try { const value = window.localStorage.getItem(MODE_KEY); return value === 'grid' || value === 'list' || value === 'grouped' ? value : 'table'; } catch { return 'table'; }
}

/** Audit actions that describe structure/content work (the audit trail has no fixed vocabulary, so this is a keyword filter). */
const VIEW_ACTION = /(panel|categor|subcategor|revision|publish|template|north|view)/i;
const activityKind = (action: string) => /publish/i.test(action) ? 'publish' : /restor/i.test(action) ? 'restore' : /archiv|delet|remov/i.test(action) ? 'archive' : /creat/i.test(action) ? 'create' : /reorder|clone|move/i.test(action) ? 'structure' : 'edit';

export function ViewsWorkspace({ loadError, onRetry, onOpenEditor }: { loadError: string | null; onRetry: () => void; onOpenEditor: () => void }) {
  const { t, locale } = useI18n();
  // Layout follows the room this screen really has (the shell's rails already use a lot of the viewport).
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const { organizationId, taxonomy, loading, setModal, refreshTaxonomy, selectPanel, setActiveMode } = useViewsEditor();
  const { push } = useNotifications();
  const { activeOrganization } = useOrganization();
  const { navigate } = useTabs();
  const goAdmin = useAdminNavigation();

  const { filters, setFilters, patch, clear } = useViewFilters(organizationId);
  const savedFilters = useSavedFilters(organizationId);
  const [display, setDisplay] = useState<DisplayMode>(readMode);
  const [groupBy, setGroupBy] = useState<GroupBy>('category');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorSheet, setInspectorSheet] = useState(false);
  const [savingName, setSavingName] = useState<string | null>(null);
  const [loadedSaved, setLoadedSaved] = useState<string | null>(null);
  const [overviewOpen, setOverviewOpen] = useState(true);

  const dockExplorer = width >= 760;
  const wide = width >= 1000; // inspector docked on the right (collapsible); narrower: a drawer over the same state
  const threePane = dockExplorer && wide;
  const inlineFilters = width >= 700;

  const resources = useMemo(() => flattenTree((taxonomy ?? []) as unknown as TreeCategory[]), [taxonomy]);
  const selected = useMemo(() => resources.find((resource) => resource.id === selectedId) ?? null, [resources, selectedId]);
  const { matched } = useMemo(() => queryResources(resources, filters, locale), [resources, filters, locale]);
  const stats = useMemo(() => summarize(resources), [resources]);
  const health = useMemo(() => detectHealth(resources), [resources]);
  const activeFilters = activeFilterCount(filters);
  const scopeIds = useMemo(() => [...filters.categoryIds, ...filters.subcategoryIds], [filters.categoryIds, filters.subcategoryIds]);

  const members = useResource(() => listMembers(organizationId), [organizationId]);
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const audit = useResource(() => listAuditEntries(organizationId, { limit: 40 }), [organizationId]);
  const byUser = useMemo(() => new Map((members.data ?? []).map((member) => [member.userId, member])), [members.data]);
  const userName = useCallback((userId: string | null) => (userId ? byUser.get(userId)?.name?.trim() || byUser.get(userId)?.email || `${userId.slice(0, 8)}…` : '—'), [byUser]);

  // Version/author/publication need one read per visible view; only the rows of the current result set are requested.
  const visibleForRevisions = useMemo(() => matched.filter((resource) => resource.kind === 'PANEL').slice(0, 48), [matched]);
  const revisions = useRevisionInfo(organizationId, visibleForRevisions);

  useEffect(() => { try { window.localStorage.setItem(MODE_KEY, display); } catch { /* ignore */ } }, [display]);

  const edit = useCallback((resource: ViewResource) => {
    if (resource.kind !== 'PANEL') return;
    selectPanel(resource.categoryId, resource.subcategoryId!, resource.id);
    setActiveMode('editor');
    onOpenEditor();
  }, [onOpenEditor, selectPanel, setActiveMode]);

  /** Opens the *published* view in the shell through the normal tab system (current tab navigates; no new tab). */
  const open = useCallback(async (resource: ViewResource) => {
    const category = resources.find((item) => item.id === resource.categoryId);
    const subcategory = resources.find((item) => item.id === resource.subcategoryId);
    if (resource.kind !== 'PANEL' || !activeOrganization?.slug || !category || !subcategory) return;
    try {
      const result = await resolvePublishedPanel({ organizationSlug: activeOrganization.slug, categorySlug: category.slug, subcategorySlug: subcategory.slug, panelSlug: resource.slug });
      navigate(result.category.id, result.subcategory.id, publishedTabFromResolved(result));
      if (result.canonicalPath) pushPath(result.canonicalPath);
    } catch (reason) { push({ type: 'error', title: reason instanceof Error ? reason.message : t('state.loadError') }); }
  }, [activeOrganization?.slug, navigate, push, resources, t]);

  const inspect = useCallback((resource: ViewResource) => { setSelectedId(resource.id); if (!wide) setInspectorSheet(true); else setInspectorOpen(true); }, [wide]);

  const actions = useViewActions({
    organizationId, resources, setModal, onEdit: edit, onOpen: (resource) => void open(resource), onInspect: inspect,
    refresh: refreshTaxonomy, onError: (message) => push({ type: 'error', title: message }),
  });

  const selectFromResults = (resource: ViewResource) => { setSelectedId(resource.id); if (!wide) setInspectorSheet(true); };
  // Explorer: a category/subcategory also scopes the result list to it (visible and removable as a chip).
  const selectFromExplorer = (resource: ViewResource) => {
    setSelectedId(resource.id);
    if (resource.kind === 'CATEGORY') patch({ categoryIds: [resource.id], subcategoryIds: [] });
    else if (resource.kind === 'SUBCATEGORY') patch({ categoryIds: [], subcategoryIds: [resource.id] });
    if (!wide) { setExplorerOpen(false); }
  };
  const activate = (resource: ViewResource) => { if (resource.kind === 'PANEL') edit(resource); else inspect(resource); };

  // Context for "create" quick actions: the selected node (or its parent) decides where the new resource goes.
  const targetCategory = selected ? resources.find((resource) => resource.id === selected.categoryId) : resources.filter((r) => r.kind === 'CATEGORY' && r.resourceKind === 'CONTENT' && r.status === 'ACTIVE').length === 1 ? resources.find((r) => r.kind === 'CATEGORY' && r.resourceKind === 'CONTENT' && r.status === 'ACTIVE') : undefined;
  const contentSubs = resources.filter((r) => r.kind === 'SUBCATEGORY' && r.resourceKind === 'CONTENT' && r.status === 'ACTIVE');
  const targetSub = selected?.subcategoryId ? resources.find((resource) => resource.id === selected.subcategoryId) : contentSubs.length === 1 ? contentSubs[0] : undefined;
  const canCreate = taxonomy !== null; // the management tree is only served to people CORECROW authorizes to manage structure

  const cards: Array<{ id: string; label: string; value: number; icon: IconComponent; apply?: Partial<ViewFilters>; note?: string }> = [
    { id: 'total', label: t('adm2.views.kpi.total'), value: stats.views, icon: Stack, apply: { kinds: ['PANEL'] } },
    { id: 'published', label: t('adm2.views.kpi.published'), value: stats.published, icon: FileText, apply: { kinds: ['PANEL'], statuses: ['PUBLISHED'] } },
    { id: 'drafts', label: t('adm2.views.kpi.drafts'), value: stats.drafts, icon: PencilSimpleLine, apply: { kinds: ['PANEL'], statuses: ['DRAFT'] } },
    { id: 'changes', label: t('adm2.views.kpi.unpublished'), value: stats.withUnpublishedChanges, icon: Warning, apply: { kinds: ['PANEL'], unpublishedOnly: true } },
    { id: 'archived', label: t('adm2.views.kpi.archived'), value: stats.archived, icon: Stack, apply: { kinds: ['PANEL'], statuses: ['ARCHIVED'] } },
    { id: 'recent', label: t('adm2.views.kpi.recent'), value: stats.recentlyUpdated, icon: ArrowsClockwise, apply: { kinds: ['PANEL'], updatedFrom: new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10), sort: 'updatedAt', dir: 'desc' }, note: t('adm2.views.kpi.recentNote') },
    { id: 'structure', label: t('adm2.views.kpi.structure'), value: stats.categories + stats.subcategories, icon: Tree, apply: { kinds: ['CATEGORY', 'SUBCATEGORY'] }, note: `${stats.categories} / ${stats.subcategories}` },
    { id: 'datasets', label: t('adm2.views.kpi.datasets'), value: datasets.data ? datasets.data.filter((dataset) => dataset.status === 'ACTIVE').length : 0, icon: Database },
  ];

  const recent = (audit.data ?? []).filter((entry) => VIEW_ACTION.test(entry.action)).slice(0, 5);
  const explorer = (
    <StructureExplorer
      organizationId={organizationId} resources={resources} loading={loading} selectedId={selectedId} scopeIds={scopeIds}
      onSelect={selectFromExplorer} onActivate={activate} onCreateCategory={() => setModal({ type: 'create_category' })}
      menuFor={actions.menuFor} canCreate={canCreate} className="h-full"
    />
  );
  const inspector = (
    <ResourceInspector
      organizationId={organizationId} resource={selected} userName={userName} canEdit={canCreate}
      onClose={wide ? () => setInspectorOpen(false) : () => setInspectorSheet(false)}
      onEdit={edit} onOpen={(resource) => void open(resource)} onDuplicate={actions.duplicate} onArchive={actions.requestArchive} onRename={actions.openRename}
    />
  );

  const pathParts = selected ? [selected.kind !== 'CATEGORY' ? localName(selected.categoryName, locale) : null, selected.kind === 'PANEL' ? localName(selected.subcategoryName, locale) : null, localName(selected.name, locale)].filter(Boolean) as string[] : [];

  return (
    <div ref={rootRef} className="flex h-full min-h-0 min-w-0 flex-1 overflow-hidden bg-background">
      {dockExplorer ? <aside aria-label={t('adm2.views.structure')} className={cn('shrink-0 border-r border-border bg-surface', threePane ? 'w-64' : 'w-56')}>{explorer}</aside> : null}

      <div className="@container flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 py-2 lg:px-4">
          {!dockExplorer ? <Button size="icon" variant="ghost" aria-label={t('adm2.views.structure')} onClick={() => setExplorerOpen(true)}><Tree /></Button> : null}
          <nav aria-label="breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs text-text-secondary">
            <button type="button" onClick={() => goAdmin('overview')} className="hidden shrink-0 hover:text-text @lg:inline">{t('personal.administration')}</button>
            <CaretRight className="hidden size-3 shrink-0 text-text-muted @lg:block" />
            <button type="button" onClick={() => { setSelectedId(null); clear(); }} className={cn('shrink-0', pathParts.length ? 'hover:text-text' : 'font-medium text-text')}>{t('adm.nav.views')}</button>
            {pathParts.map((part, index) => <span key={`${part}-${index}`} className="flex min-w-0 items-center gap-1"><CaretRight className="size-3 shrink-0 text-text-muted" /><span className={cn('truncate', index === pathParts.length - 1 && 'font-medium text-text')}>{part}</span></span>)}
          </nav>
          <div className="relative order-last w-full @2xl:order-none @2xl:w-64">
            <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <Input className="pl-7" value={filters.q} onChange={(event) => patch({ q: event.target.value })} placeholder={t('adm2.views.search')} aria-label={t('adm2.views.search')} />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Button size="sm" variant="accent" disabled={!canCreate} onClick={() => (targetSub ? setModal({ type: 'create_view', categoryId: targetSub.categoryId, subcategoryId: targetSub.id }) : setModal({ type: 'create_category' }))} title={targetSub ? undefined : t('adm2.views.createViewHint')}><Plus /><span className="hidden @md:inline">{targetSub ? t('adm2.views.qa.createView') : t('adm2.views.qa.createCategory')}</span><span className="sr-only @md:hidden">{targetSub ? t('adm2.views.qa.createView') : t('adm2.views.qa.createCategory')}</span></Button>
            <Button size="icon" variant="ghost" aria-label={t('access.refresh')} title={t('access.refresh')} onClick={onRetry}><ArrowsClockwise /></Button>
            <Button size="icon" variant="ghost" aria-label={t('adm2.views.inspector.toggle')} aria-pressed={wide ? inspectorOpen : inspectorSheet} onClick={() => (wide ? setInspectorOpen((value) => !value) : setInspectorSheet(true))}><SidebarSimple className="-scale-x-100" /></Button>
          </div>
        </header>

        <div className="@container min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] space-y-4 p-3 lg:p-4">
            {loadError ? (
              <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error"><Warning className="size-4 shrink-0" /><span className="min-w-0 flex-1">{loadError}</span><Button size="sm" variant="outline" onClick={onRetry}>{t('error.retry')}</Button></div>
            ) : null}

            <section aria-label={t('adm2.views.overview')} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h1 className="font-display text-base font-semibold text-text">{t('adm2.views.title')}</h1>
                <button type="button" aria-expanded={overviewOpen} onClick={() => setOverviewOpen((value) => !value)} className="text-xs text-accent hover:underline">{overviewOpen ? t('adm2.views.hideOverview') : t('adm2.views.showOverview')}</button>
              </div>
              {overviewOpen ? (
                <>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
                    {cards.map((card) => (
                      <button key={card.id} type="button" disabled={!card.apply} onClick={() => card.apply && setFilters({ ...emptyFilters(), ...card.apply })} className="np-card np-press-flat flex min-w-0 items-start justify-between gap-2 p-3 text-left transition-[border-color,transform] duration-(--duration-fast) enabled:hover:border-border-hover">
                        <div className="min-w-0">
                          <p className="ui-label truncate pb-0.5">{card.label}</p>
                          {loading && !taxonomy ? <Skeleton className="h-7 w-10" /> : <p className="font-display text-xl font-semibold tabular-nums text-text">{card.value}</p>}
                          {card.note ? <p className="truncate text-[10px] text-text-muted">{card.note}</p> : null}
                        </div>
                        <Icon icon={card.icon} size="sm" className="mt-0.5 text-text-muted" />
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 @4xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="np-card space-y-2 p-3">
                      <h2 className="text-xs font-semibold text-text">{t('adm2.qa.title')}</h2>
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" disabled={!canCreate || !targetSub} title={targetSub ? undefined : t('adm2.views.createViewHint')} onClick={() => targetSub && setModal({ type: 'create_view', categoryId: targetSub.categoryId, subcategoryId: targetSub.id })}><Plus />{t('adm2.views.qa.createView')}</Button>
                        <Button size="sm" variant="secondary" disabled={!canCreate} onClick={() => setModal({ type: 'create_category' })}><FolderSimplePlus />{t('adm2.views.qa.createCategory')}</Button>
                        <Button size="sm" variant="secondary" disabled={!canCreate || !targetCategory} title={targetCategory ? undefined : t('adm2.views.createSubHint')} onClick={() => targetCategory && setModal({ type: 'create_subcategory', categoryId: targetCategory.id })}><FolderSimplePlus />{t('adm2.views.qa.createSubcategory')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setFilters({ ...emptyFilters(), kinds: ['PANEL'], statuses: ['DRAFT'] })}><PencilSimpleLine />{t('adm2.views.qa.openDrafts')}</Button>
                        <Button size="sm" variant="secondary" onClick={() => setFilters({ ...emptyFilters(), kinds: ['PANEL'], unpublishedOnly: true })}><Warning />{t('adm2.views.qa.review')}</Button>
                      </div>
                      <p className="text-[10px] text-text-muted">{t('adm2.views.qa.note')}</p>
                    </div>
                    <div className="np-card space-y-2 p-3">
                      <h2 className="text-xs font-semibold text-text">{t('adm2.views.health.title')}</h2>
                      {health.length === 0 ? <p className="text-xs text-text-secondary">{loading ? t('admin.loading') : t('adm2.views.health.none')}</p> : (
                        <ul className="space-y-1">
                          {health.slice(0, 5).map((issue) => { const resource = resources.find((item) => item.id === issue.resourceId); return resource ? (
                            <li key={issue.id}><button type="button" onClick={() => { setSelectedId(resource.id); if (!wide) setInspectorSheet(true); }} className="flex w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left text-xs hover:bg-surface-hover"><Warning className={cn('mt-0.5 size-3 shrink-0', issue.severity === 'warning' ? 'text-warning' : 'text-text-muted')} /><span className="min-w-0"><span className="block truncate text-text">{localName(resource.name, locale)}</span><span className="block truncate text-[11px] text-text-muted">{t(`adm2.views.health.${issue.code}` as never)}</span></span></button></li>
                          ) : null; })}
                          {health.length > 5 ? <li className="px-1 text-[11px] text-text-muted">{t('adm2.views.health.more', { count: health.length - 5 })}</li> : null}
                        </ul>
                      )}
                    </div>
                    <div className="np-card space-y-2 p-3">
                      <h2 className="text-xs font-semibold text-text">{t('adm2.activity.title')}</h2>
                      {audit.status === 'loading' ? <Skeleton className="h-16 w-full" /> : audit.status === 'forbidden' ? <p className="text-xs text-text-muted">{t('adm2.audit.forbidden')}</p> : recent.length === 0 ? <p className="text-xs text-text-secondary">{t('adm2.views.activity.none')}</p> : (
                        <ol className="space-y-1.5">
                          {recent.map((entry) => <li key={entry.id} className="flex items-start gap-2 text-xs"><span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" /><div className="min-w-0 flex-1"><p className="truncate text-text">{t(`adm2.views.activity.${activityKind(entry.action)}` as never)}</p><p className="truncate text-[11px] text-text-muted">{entry.action} · {entry.actorId ? userName(entry.actorId) : t('adm2.audit.system')}</p></div><time className="shrink-0 text-[11px] text-text-muted" dateTime={entry.createdAt}>{formatWhen(entry.createdAt, locale)}</time></li>)}
                        </ol>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </section>

            <section aria-label={t('adm2.filters.title')} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" variant={filtersOpen || activeFilters > 0 ? 'secondary' : 'outline'} aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}>
                  <Funnel />{t('adm2.filters.title')}{activeFilters > 0 ? <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white tabular-nums">{activeFilters}</span> : null}
                </Button>
                {activeFilters > 0 ? <Button size="sm" variant="ghost" onClick={clear}><X />{t('adm2.filters.clear')}</Button> : null}
                <div className="ml-auto flex items-center gap-1.5">
                  {savedFilters.saved.length > 0 ? (
                    <label className="flex items-center gap-1 text-xs text-text-secondary"><BookmarkSimple className="size-3.5" />
                      <select aria-label={t('adm2.filters.saved')} value="" onChange={(event) => { const item = savedFilters.saved.find((candidate) => candidate.id === event.target.value); if (item) { setFilters(savedFilters.load(item)); setLoadedSaved(item.id); } }} className="h-8 max-w-40 rounded-md border border-border bg-surface px-2 text-xs text-text">
                        <option value="">{t('adm2.filters.saved')}</option>{savedFilters.saved.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </label>
                  ) : null}
                  {savingName === null ? (
                    <Button size="sm" variant="ghost" disabled={activeFilters === 0} onClick={() => setSavingName('')}><BookmarkSimple />{t('adm2.filters.save')}</Button>
                  ) : (
                    <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); if (savingName.trim()) { savedFilters.save(savingName, filters); setSavingName(null); } }}>
                      <Input autoFocus className="w-36" value={savingName} maxLength={60} placeholder={t('adm2.filters.saveName')} aria-label={t('adm2.filters.saveName')} onChange={(event) => setSavingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setSavingName(null); }} />
                      <Button size="sm" type="submit" variant="accent" disabled={!savingName.trim()}>{t('adm.settings.save')}</Button>
                    </form>
                  )}
                  {loadedSaved ? <Button size="sm" variant="ghost" aria-label={t('adm2.filters.deleteSaved')} title={t('adm2.filters.deleteSaved')} onClick={() => { savedFilters.remove(loadedSaved); setLoadedSaved(null); }}><X /></Button> : null}
                </div>
              </div>
              {filtersOpen && inlineFilters ? <div className="np-card np-fade-in p-4"><FilterPanel filters={filters} resources={resources} onChange={patch} onClear={clear} active={activeFilters} /></div> : null}
              <FilterChips filters={filters} resources={resources} onChange={patch} />
            </section>

            <ResultsPane
              matched={matched} total={resources.length} loading={loading && !taxonomy} error={loadError} onRetry={onRetry} filters={filters}
              onSort={(sort, dir) => patch({ sort, dir })} mode={display} onMode={setDisplay} groupBy={groupBy} onGroupBy={setGroupBy}
              selectedId={selectedId} onSelect={selectFromResults} onActivate={activate} menuFor={actions.menuFor} revisions={revisions} userName={userName}
              onClearFilters={clear} hasFilters={activeFilters > 0} narrow={width < 640}
            />
          </div>
        </div>
      </div>

      {threePane && inspectorOpen ? <aside aria-label={t('adm2.views.inspector.title')} className={cn('shrink-0 border-l border-border bg-surface', width >= 1240 ? 'w-80' : 'w-72')}>{inspector}</aside> : null}

      {/* Narrow screens: structure, filters and inspector are drawers over the same state — nothing is squeezed. */}
      <Sheet open={explorerOpen && !dockExplorer} onOpenChange={setExplorerOpen} side="left" title={t('adm2.views.structure')}><div className="-mx-4 -mb-4 h-[calc(100dvh-5rem)]">{explorer}</div></Sheet>
      <Sheet open={filtersOpen && !inlineFilters} onOpenChange={setFiltersOpen} side="bottom" title={t('adm2.filters.title')}><FilterPanel filters={filters} resources={resources} onChange={patch} onClear={clear} active={activeFilters} /></Sheet>
      <Sheet open={inspectorSheet && !wide} onOpenChange={setInspectorSheet} side="right" title={t('adm2.views.inspector.title')} hideTitle><div className="-mx-4 -mb-4 h-[calc(100dvh-4.5rem)]">{inspector}</div></Sheet>
      {actions.dialogs}
    </div>
  );
}
