import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { ArrowDown, ArrowUp, CaretLeft, CaretRight, CaretUpDown, DotsThree, FileText, Folder, FolderSimple, LockSimple, MagnifyingGlass, SquaresFour, Rows, Table, TextAlignJustify } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { groupResources, localName, paginate, type GroupBy, type SortKey, type ViewFilters, type ViewResource } from './resources';
import type { RevisionInfo } from './useViewsWorkspace';

export type DisplayMode = 'table' | 'grid' | 'list' | 'grouped';
const PAGE_SIZES = [12, 24, 48];

export function formatWhen(iso: string | null, locale: string, now = Date.now()) {
  if (!iso) return '—';
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return '—';
  const days = (now - time) / 86_400_000;
  if (days >= 0 && days < 1) {
    const hours = Math.floor(days * 24);
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-(hours || Math.max(1, Math.floor(days * 1440))), hours ? 'hour' : 'minute');
  }
  return new Date(time).toLocaleDateString(locale, { dateStyle: 'medium' });
}

function StatusPill({ resource }: { resource: ViewResource }) {
  const { t } = useI18n();
  const tone = resource.status === 'PUBLISHED' || resource.status === 'ACTIVE' ? 'active' : resource.status === 'ARCHIVED' ? 'neutral' : 'pending';
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Status tone={tone}>{t(`adm2.views.status.${resource.status}` as never)}</Status>
      {resource.hasUnpublishedChanges ? <Status tone="pending">{t('adm2.views.status.unpublished')}</Status> : null}
    </span>
  );
}

const kindIcon = (resource: ViewResource) => (resource.kind === 'PANEL' ? FileText : resource.kind === 'CATEGORY' ? Folder : FolderSimple);

export function ResultsPane({ matched, total, loading, error, onRetry, filters, onSort, mode, onMode, groupBy, onGroupBy, selectedId, onSelect, onActivate, menuFor, revisions, userName, locale: localeOverride, onClearFilters, hasFilters, narrow }: {
  /** Too little room for a table: it is replaced by the compact list (the stored preference is untouched). */
  narrow?: boolean;
  matched: ViewResource[];
  total: number;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  filters: ViewFilters;
  onSort: (sort: SortKey, dir: 'asc' | 'desc') => void;
  mode: DisplayMode;
  onMode: (mode: DisplayMode) => void;
  groupBy: GroupBy;
  onGroupBy: (by: GroupBy) => void;
  selectedId: string | null;
  onSelect: (resource: ViewResource) => void;
  onActivate: (resource: ViewResource) => void;
  menuFor: (resource: ViewResource) => MenuItem[];
  revisions: Record<string, RevisionInfo | null | 'error'>;
  userName: (userId: string | null) => string;
  locale?: string;
  onClearFilters: () => void;
  hasFilters: boolean;
}) {
  const { t, locale: contextLocale } = useI18n();
  const locale = localeOverride ?? contextLocale;
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1]!);
  const [page, setPage] = useState(1);
  const [menu, setMenu] = useState<{ x: number; y: number; resource: ViewResource } | null>(null);
  const shown: DisplayMode = narrow && mode === 'table' ? 'list' : mode;
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // A new result set (filters, sort, data) starts on its first page.
  useEffect(() => { setPage(1); }, [matched, pageSize]);
  const paged = useMemo(() => paginate(matched, page, pageSize), [matched, page, pageSize]);
  const grouped = useMemo(() => (shown === 'grouped' ? groupResources(paged.items, groupBy === 'none' ? 'category' : groupBy, locale) : []), [shown, paged.items, groupBy, locale]);

  const openMenu = (resource: ViewResource, x: number, y: number) => { onSelect(resource); setMenu({ x, y, resource }); };
  const rowProps = (resource: ViewResource) => ({
    'data-selected': resource.id === selectedId || undefined,
    tabIndex: 0,
    onClick: () => onSelect(resource),
    onDoubleClick: () => onActivate(resource),
    onContextMenu: (event: MouseEvent) => { event.preventDefault(); openMenu(resource, event.clientX, event.clientY); },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter') { event.preventDefault(); onActivate(resource); }
      else if (event.key === ' ') { event.preventDefault(); onSelect(resource); }
      else if (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)) { event.preventDefault(); const box = event.currentTarget.getBoundingClientRect(); openMenu(resource, box.left + 32, box.bottom); }
    },
  });
  const kebab = (resource: ViewResource) => (
    <button type="button" aria-label={t('adm2.views.actions')} aria-haspopup="menu" onClick={(event) => { event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); openMenu(resource, box.left - 140, box.bottom + 2); }} className="grid size-7 place-items-center rounded-md text-text-muted transition-colors duration-(--duration-fast) hover:bg-surface-active hover:text-text pointer-coarse:size-(--touch-min)"><DotsThree weight="bold" className="size-4" /></button>
  );
  const category = (resource: ViewResource) => resource.kind === 'CATEGORY' ? '—' : `${localName(resource.categoryName, locale)}${resource.subcategoryName && resource.kind === 'PANEL' ? ` / ${localName(resource.subcategoryName, locale)}` : ''}`;
  const nameCell = (resource: ViewResource) => (
    <div className="flex min-w-0 items-center gap-2">
      <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-active text-text-secondary"><Icon icon={kindIcon(resource)} size="sm" weight={resource.kind === 'PANEL' ? 'regular' : 'duotone'} /></span>
      <div className="min-w-0">
        <p className={cn('flex items-center gap-1 truncate text-[13px] font-medium text-text', resource.status === 'ARCHIVED' && 'text-text-muted line-through')}>{localName(resource.name, locale)}{resource.resourceKind === 'SYSTEM' ? <LockSimple className="size-3 shrink-0 text-text-muted" aria-label={t('adm2.views.system')} /> : null}</p>
        <p className="truncate font-mono text-[11px] text-text-muted">{resource.slug}</p>
      </div>
    </div>
  );
  const revisionCell = (resource: ViewResource, pick: (info: RevisionInfo) => string) => {
    if (resource.kind !== 'PANEL') return '—';
    const info = revisions[resource.id];
    if (info === undefined) return (resource.draftRevisionId || resource.publishedRevisionId) ? <Skeleton className="h-3 w-10" /> : '—';
    return info && info !== 'error' ? pick(info) : '—';
  };

  const sortHeader = (key: SortKey, label: string, className?: string) => {
    const active = filters.sort === key;
    const SortIcon = !active ? CaretUpDown : filters.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <th scope="col" aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('border-b border-border p-0 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted', className)}>
        <button type="button" onClick={() => onSort(key, active && filters.dir === 'desc' ? 'asc' : 'desc')} className="flex w-full items-center gap-1 px-3 py-2 transition-colors duration-(--duration-fast) hover:text-text pointer-coarse:min-h-(--touch-min)">{label}<SortIcon className={cn('size-3', active ? 'text-accent' : 'text-text-muted')} aria-hidden="true" /></button>
      </th>
    );
  };
  const plainHeader = (label: string, className?: string) => <th scope="col" className={cn('border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted', className)}>{label}</th>;

  const tableFor = (items: ViewResource[]) => (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[40rem] border-separate border-spacing-0 text-xs">
        <thead className="bg-surface-hover/50">
          <tr>
            {sortHeader('name', t('adm2.views.col.name'))}
            {sortHeader('kind', t('adm2.views.col.type'), 'hidden @2xl:table-cell')}
            {sortHeader('category', t('adm2.views.col.category'), 'hidden @4xl:table-cell')}
            {sortHeader('status', t('adm2.views.col.status'))}
            {sortHeader('updatedAt', t('adm2.views.col.updated'), 'hidden @xl:table-cell')}
            {plainHeader(t('adm2.views.col.updatedBy'), 'hidden @7xl:table-cell')}
            {plainHeader(t('adm2.views.col.version'), 'hidden @5xl:table-cell')}
            {plainHeader(t('adm2.views.col.published'), 'hidden @7xl:table-cell')}
            {plainHeader(t('adm2.views.col.audience'), 'hidden @7xl:table-cell')}
            <th className="w-10 border-b border-border" aria-label={t('adm2.views.actions')} />
          </tr>
        </thead>
        <tbody>
          {items.map((resource) => (
            <tr key={resource.id} {...rowProps(resource)} className="group cursor-pointer outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover/60 focus-visible:bg-surface-hover data-[selected]:bg-accent-soft/60">
              <td className="max-w-[18rem] border-b border-border/60 px-3 py-2">{nameCell(resource)}</td>
              <td className="hidden border-b border-border/60 px-3 py-2 text-text-secondary @2xl:table-cell">{t(`adm2.views.kind.${resource.kind}` as never)}</td>
              <td className="hidden max-w-[14rem] truncate border-b border-border/60 px-3 py-2 text-text-secondary @4xl:table-cell">{category(resource)}</td>
              <td className="border-b border-border/60 px-3 py-2"><StatusPill resource={resource} /></td>
              <td className="hidden whitespace-nowrap border-b border-border/60 px-3 py-2 text-text-secondary @xl:table-cell" title={resource.updatedAt ?? undefined}>{formatWhen(resource.updatedAt, locale)}</td>
              <td className="hidden max-w-[10rem] truncate border-b border-border/60 px-3 py-2 text-text-secondary @7xl:table-cell">{revisionCell(resource, (info) => userName(info.latestBy))}</td>
              <td className="hidden border-b border-border/60 px-3 py-2 tabular-nums text-text-secondary @5xl:table-cell">{revisionCell(resource, (info) => `v${info.latestNumber}${info.publishedNumber !== null ? ` · ${t('adm2.views.live')} v${info.publishedNumber}` : ''}`)}</td>
              <td className="hidden whitespace-nowrap border-b border-border/60 px-3 py-2 text-text-secondary @7xl:table-cell">{revisionCell(resource, (info) => formatWhen(info.publishedAt, locale))}</td>
              <td className="hidden border-b border-border/60 px-3 py-2 text-text-secondary @7xl:table-cell">{resource.audienceType ? t(`adm2.views.audience.${resource.audienceType}` as never) : '—'}</td>
              <td className="border-b border-border/60 px-1 py-1 text-right">{kebab(resource)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const gridFor = (items: ViewResource[]) => (
    <ul className="grid grid-cols-1 gap-3 @lg:grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4">
      {items.map((resource) => (
        <li key={resource.id}>
          <div {...rowProps(resource)} className="np-card np-press-flat group flex h-full cursor-pointer flex-col gap-2 p-3 outline-none transition-[border-color,box-shadow] duration-(--duration-fast) hover:border-border-hover focus-visible:ring-2 focus-visible:ring-accent/40 data-[selected]:border-accent data-[selected]:shadow-soft">
            <div className="flex items-start justify-between gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-active text-text-secondary"><Icon icon={kindIcon(resource)} size="md" weight="duotone" /></span>
              {kebab(resource)}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-sm font-medium text-text', resource.status === 'ARCHIVED' && 'text-text-muted line-through')}>{localName(resource.name, locale)}</p>
              <p className="line-clamp-2 min-h-8 text-xs text-text-secondary">{resource.description ? localName(resource.description, locale) : category(resource)}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] uppercase text-text-secondary">{t(`adm2.views.kind.${resource.kind}` as never)}</span><StatusPill resource={resource} /></div>
            <p className="text-[11px] text-text-muted">{t('adm2.views.col.updated')}: {formatWhen(resource.updatedAt, locale)}</p>
          </div>
        </li>
      ))}
    </ul>
  );

  const listFor = (items: ViewResource[]) => (
    <ul className="divide-y divide-border/60 rounded-lg border border-border">
      {items.map((resource) => (
        <li key={resource.id}>
          <div {...rowProps(resource)} className="flex cursor-pointer items-center gap-3 px-3 py-1.5 outline-none transition-colors duration-(--duration-fast) hover:bg-surface-hover/60 focus-visible:bg-surface-hover data-[selected]:bg-accent-soft/60">
            <Icon icon={kindIcon(resource)} size="sm" className="text-text-secondary" />
            <span className={cn('min-w-0 flex-1 truncate text-[13px] text-text', resource.status === 'ARCHIVED' && 'text-text-muted line-through')}>{localName(resource.name, locale)}<span className="ml-2 text-[11px] text-text-muted">{category(resource)}</span></span>
            <span className="hidden shrink-0 @xl:block"><StatusPill resource={resource} /></span>
            <span className="hidden w-24 shrink-0 text-right text-[11px] text-text-muted @3xl:block">{formatWhen(resource.updatedAt, locale)}</span>
            {kebab(resource)}
          </div>
        </li>
      ))}
    </ul>
  );

  const modes: Array<{ id: DisplayMode; label: string; icon: typeof Table }> = [
    { id: 'table', label: t('adm2.views.mode.table'), icon: Table }, { id: 'grid', label: t('adm2.views.mode.grid'), icon: SquaresFour },
    { id: 'list', label: t('adm2.views.mode.list'), icon: TextAlignJustify }, { id: 'grouped', label: t('adm2.views.mode.grouped'), icon: Rows },
  ];

  return (
    <section aria-label={t('adm2.views.results')} aria-busy={loading || undefined} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p role="status" aria-live="polite" className="text-xs text-text-secondary">
          {loading ? t('admin.loading') : error ? t('adm2.views.queryError') : t('adm2.views.countSummary', { matched: matched.length, total, from: paged.from, to: paged.to })}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {shown === 'grouped' ? (
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">{t('adm2.views.groupBy')}
              <select value={groupBy === 'none' ? 'category' : groupBy} onChange={(event) => onGroupBy(event.target.value as GroupBy)} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text">
                {(['category', 'status', 'kind', 'month'] as const).map((by) => <option key={by} value={by}>{t(`adm2.views.group.${by}` as never)}</option>)}
              </select>
            </label>
          ) : null}
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">{t('adm2.views.sortBy')}
            <select value={`${filters.sort}:${filters.dir}`} onChange={(event) => { const [sort, dir] = event.target.value.split(':'); onSort(sort as SortKey, dir as 'asc' | 'desc'); }} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text">
              {(['updatedAt', 'createdAt', 'name', 'status', 'kind', 'category'] as const).flatMap((key) => (['desc', 'asc'] as const).map((dir) => <option key={`${key}:${dir}`} value={`${key}:${dir}`}>{t(`adm2.views.sort.${key}` as never)} {dir === 'asc' ? '↑' : '↓'}</option>))}
            </select>
          </label>
          <div role="group" aria-label={t('adm2.views.mode')} className="inline-flex gap-0.5 rounded-lg bg-surface-hover p-0.5">
            {modes.filter((item) => !(narrow && item.id === 'table')).map((item) => (
              <button key={item.id} type="button" aria-pressed={shown === item.id} title={item.label} aria-label={item.label} onClick={() => onMode(item.id)} className={cn('grid size-7 place-items-center rounded-md transition-colors duration-(--duration-fast) pointer-coarse:size-(--touch-min)', shown === item.id ? 'bg-surface text-text shadow-soft' : 'text-text-muted hover:text-text')}><item.icon className="size-4" /></button>
            ))}
          </div>
        </div>
      </div>

      {error && matched.length === 0 ? (
        <div role="alert" className="rounded-xl border border-dashed border-error/40 p-6 text-center"><p className="text-sm font-medium text-text">{t('state.loadError')}</p><p className="mt-1 text-xs text-text-secondary">{error}</p><Button size="sm" variant="outline" className="mt-3" onClick={onRetry}>{t('error.retry')}</Button></div>
      ) : loading && total === 0 ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-11 w-full" />)}</div>
      ) : matched.length === 0 ? (
        <EmptyState icon={MagnifyingGlass} title={hasFilters ? t('adm2.views.noResults') : t('adm2.views.empty')} body={hasFilters ? t('adm2.views.noResultsBody') : t('adm2.views.emptyBody')} className="py-12" action={hasFilters ? <Button size="sm" variant="secondary" onClick={onClearFilters}>{t('adm2.filters.clear')}</Button> : undefined} />
      ) : (
        <div key={`${shown}`} className="np-fade-in">
          {shown === 'table' ? tableFor(paged.items) : shown === 'grid' ? gridFor(paged.items) : shown === 'list' ? listFor(paged.items) : (
            <div className="space-y-3">
              {grouped.map((group) => {
                const closed = collapsedGroups.has(group.key);
                return (
                  <div key={group.key} className="space-y-1.5">
                    <button type="button" aria-expanded={!closed} onClick={() => setCollapsedGroups((current) => { const next = new Set(current); if (next.has(group.key)) next.delete(group.key); else next.add(group.key); return next; })} className="flex w-full items-center gap-1.5 text-left text-xs font-semibold text-text-secondary hover:text-text pointer-coarse:min-h-(--touch-min)">
                      {closed ? <CaretRight className="size-3" /> : <CaretUpDown className="size-3" />}{group.label}<span className="rounded-full bg-surface-active px-1.5 text-[10px] font-normal tabular-nums">{group.items.length}</span>
                    </button>
                    {closed ? null : listFor(group.items)}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {matched.length > 0 ? (
        <nav aria-label={t('adm2.views.pagination')} className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">{t('adm2.views.perPage')}
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-text">{PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}</select>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-text-secondary">{t('adm2.views.pageOf', { page: paged.page, pages: paged.pages })}</span>
            <Button size="icon-sm" variant="outline" aria-label={t('adm2.views.prev')} disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}><CaretLeft /></Button>
            <Button size="icon-sm" variant="outline" aria-label={t('adm2.views.next')} disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)}><CaretRight /></Button>
          </div>
        </nav>
      ) : null}

      {menu ? <ContextMenu x={menu.x} y={menu.y} label={t('adm2.views.actions')} items={menuFor(menu.resource)} onClose={() => setMenu(null)} /> : null}
    </section>
  );
}
