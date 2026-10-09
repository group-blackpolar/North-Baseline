import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { CaretDown, CaretRight, DotsThree, FileText, Folder, FolderOpen, FolderSimple, FolderSimplePlus, LockSimple, MagnifyingGlass, Plus, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { ContextMenu, type MenuItem } from './ContextMenu';
import { localName, matchesQuery, type ViewResource } from './resources';

const expandedKey = (organizationId: string) => `north-views-expanded:${organizationId}`;

function loadExpanded(organizationId: string): Set<string> {
  try { return new Set(JSON.parse(window.sessionStorage.getItem(expandedKey(organizationId)) ?? '[]') as string[]); } catch { return new Set(); }
}

interface Row { resource: ViewResource; depth: number; expandable: boolean; expanded: boolean }

/**
 * Resource explorer: the real Category → Subcategory → View structure from CORECROW. Selecting a node never opens a tab
 * or navigates the shell (that stays with the existing tab system); it only drives the inspector and the result scope.
 */
export function StructureExplorer({ organizationId, resources, loading, selectedId, scopeIds, onSelect, onActivate, onCreateCategory, menuFor, canCreate, className }: {
  organizationId: string;
  resources: ViewResource[];
  loading: boolean;
  selectedId: string | null;
  /** Categories / subcategories currently used as filter scope (shown with an accent bar). */
  scopeIds: string[];
  onSelect: (resource: ViewResource) => void;
  onActivate: (resource: ViewResource) => void;
  onCreateCategory: () => void;
  menuFor: (resource: ViewResource) => MenuItem[];
  canCreate: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => loadExpanded(organizationId));
  const [query, setQuery] = useState('');
  const [focusId, setFocusId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; resource: ViewResource } | null>(null);
  const treeRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    try { window.sessionStorage.setItem(expandedKey(organizationId), JSON.stringify([...expanded])); } catch { /* ignore */ }
  }, [expanded, organizationId]);

  const children = useMemo(() => {
    const map = new Map<string | null, ViewResource[]>();
    for (const resource of resources) (map.get(resource.parentId) ?? map.set(resource.parentId, []).get(resource.parentId)!).push(resource);
    return map;
  }, [resources]);

  const searching = query.trim().length > 0;
  /** While searching, a branch is kept when it or any descendant matches, and is shown open. */
  const keep = useMemo(() => {
    if (!searching) return null;
    const keepSet = new Set<string>();
    const visit = (resource: ViewResource): boolean => {
      const childMatch = (children.get(resource.id) ?? []).map(visit).some(Boolean);
      const selfMatch = matchesQuery(resource, query);
      if (selfMatch || childMatch) keepSet.add(resource.id);
      return selfMatch || childMatch;
    };
    (children.get(null) ?? []).forEach(visit);
    return keepSet;
  }, [children, query, searching]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (parent: string | null, depth: number) => {
      for (const resource of children.get(parent) ?? []) {
        if (keep && !keep.has(resource.id)) continue;
        const kids = (children.get(resource.id) ?? []).filter((kid) => !keep || keep.has(kid.id));
        const isOpen = searching ? kids.length > 0 : expanded.has(resource.id);
        out.push({ resource, depth, expandable: (children.get(resource.id) ?? []).length > 0, expanded: isOpen });
        if (isOpen) walk(resource.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }, [children, expanded, keep, searching]);

  const toggle = useCallback((id: string, open?: boolean) => setExpanded((current) => {
    const next = new Set(current);
    if (open === undefined ? next.has(id) : !open) next.delete(id); else next.add(id);
    return next;
  }), []);

  const allIds = useMemo(() => resources.filter((resource) => resource.kind !== 'PANEL').map((resource) => resource.id), [resources]);
  const currentFocus = rows.some((row) => row.resource.id === focusId) ? focusId : (rows.find((row) => row.resource.id === selectedId)?.resource.id ?? rows[0]?.resource.id ?? null);

  const focusRow = (id: string) => { setFocusId(id); requestAnimationFrame(() => treeRef.current?.querySelector<HTMLElement>(`[data-row="${CSS.escape(id)}"]`)?.focus()); };
  const openMenuAt = (resource: ViewResource, x: number, y: number) => setMenu({ x, y, resource });

  const onKeyDown = (event: KeyboardEvent<HTMLElement>, row: Row, index: number) => {
    const { resource } = row;
    switch (event.key) {
      case 'ArrowDown': event.preventDefault(); if (rows[index + 1]) focusRow(rows[index + 1]!.resource.id); break;
      case 'ArrowUp': event.preventDefault(); if (rows[index - 1]) focusRow(rows[index - 1]!.resource.id); break;
      case 'Home': event.preventDefault(); focusRow(rows[0]!.resource.id); break;
      case 'End': event.preventDefault(); focusRow(rows.at(-1)!.resource.id); break;
      case 'ArrowRight': event.preventDefault(); if (row.expandable && !row.expanded) toggle(resource.id, true); else if (row.expanded && rows[index + 1]) focusRow(rows[index + 1]!.resource.id); break;
      case 'ArrowLeft': event.preventDefault(); if (row.expanded && !searching) toggle(resource.id, false); else if (resource.parentId) focusRow(resource.parentId); break;
      case 'Enter': event.preventDefault(); onActivate(resource); break;
      case ' ': event.preventDefault(); onSelect(resource); break;
      case 'F2': {
        const rename = menuFor(resource).find((item) => item.type === 'item' && item.id === 'rename');
        if (rename?.type === 'item' && !rename.disabled) { event.preventDefault(); rename.onSelect(); }
        break;
      }
      case 'ContextMenu': event.preventDefault(); { const box = (event.currentTarget as HTMLElement).getBoundingClientRect(); openMenuAt(resource, box.left + 24, box.bottom); } break;
      case 'F10': if (event.shiftKey) { event.preventDefault(); const box = (event.currentTarget as HTMLElement).getBoundingClientRect(); openMenuAt(resource, box.left + 24, box.bottom); } break;
      default: break;
    }
  };

  const iconFor = (row: Row) => row.resource.kind === 'PANEL' ? FileText : row.resource.kind === 'CATEGORY' ? (row.expanded ? FolderOpen : Folder) : FolderSimple;

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="space-y-2 border-b border-border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="ui-label">{t('adm2.views.structure')}</h2>
          <div className="flex items-center gap-0.5">
            <Button size="icon-sm" variant="ghost" aria-label={t('adm2.views.expandAll')} title={t('adm2.views.expandAll')} onClick={() => setExpanded(new Set(allIds))}><CaretDown /></Button>
            <Button size="icon-sm" variant="ghost" aria-label={t('adm2.views.collapseAll')} title={t('adm2.views.collapseAll')} onClick={() => setExpanded(new Set())}><CaretRight /></Button>
            {canCreate ? <Button size="icon-sm" variant="ghost" aria-label={t('views.addCategory')} title={t('views.addCategory')} onClick={onCreateCategory}><FolderSimplePlus /></Button> : null}
          </div>
        </div>
        <div className="relative">
          <MagnifyingGlass className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
          <Input className="pl-7 pr-7" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('adm2.views.searchStructure')} aria-label={t('adm2.views.searchStructure')} />
          {query ? <button type="button" aria-label={t('adm2.filters.clear')} onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-text-muted hover:text-text"><X className="size-3" /></button> : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {loading && resources.length === 0 ? (
          <div className="space-y-1.5 p-1">{[0, 1, 2, 3, 4].map((index) => <Skeleton key={index} className="h-7 w-full" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-text-muted">
            <p>{searching ? t('adm2.views.noStructureMatches') : t('views.emptyStructure')}</p>
            {!searching && canCreate ? <Button size="sm" variant="outline" className="mt-3" onClick={onCreateCategory}><Plus />{t('views.addCategory')}</Button> : null}
          </div>
        ) : (
          <ul ref={treeRef} role="tree" aria-label={t('adm2.views.structure')} className="space-y-px">
            {rows.map((row, index) => {
              const { resource } = row;
              const selected = resource.id === selectedId;
              const inScope = scopeIds.includes(resource.id);
              const archived = resource.status === 'ARCHIVED';
              return (
                <li key={resource.id} role="none">
                  <div
                    role="treeitem" aria-level={row.depth + 1} aria-selected={selected} aria-expanded={row.expandable ? row.expanded : undefined}
                    data-row={resource.id} tabIndex={resource.id === currentFocus ? 0 : -1}
                    onFocus={() => setFocusId(resource.id)}
                    onClick={() => onSelect(resource)}
                    onDoubleClick={() => onActivate(resource)}
                    onKeyDown={(event) => onKeyDown(event, row, index)}
                    onContextMenu={(event: MouseEvent) => { event.preventDefault(); onSelect(resource); openMenuAt(resource, event.clientX, event.clientY); }}
                    style={{ paddingLeft: `${row.depth * 14 + 4}px` }}
                    className={cn(
                      'group relative flex cursor-pointer select-none items-center gap-1 rounded-md py-1 pr-1 text-[13px] outline-none transition-colors duration-(--duration-fast) pointer-coarse:min-h-(--touch-min) focus-visible:ring-2 focus-visible:ring-accent/40',
                      selected ? 'bg-surface-active text-text' : 'text-text-secondary hover:bg-surface-hover hover:text-text',
                    )}
                  >
                    {inScope ? <span aria-hidden="true" className="absolute inset-y-1 left-0 w-0.5 rounded bg-accent" /> : null}
                    {row.expandable ? (
                      <button type="button" tabIndex={-1} aria-label={row.expanded ? t('adm2.views.collapse') : t('adm2.views.expand')} onClick={(event) => { event.stopPropagation(); toggle(resource.id); }} className="grid size-5 shrink-0 place-items-center rounded text-text-muted hover:text-text">
                        {row.expanded ? <CaretDown className="size-3" /> : <CaretRight className="size-3" />}
                      </button>
                    ) : <span className="size-5 shrink-0" />}
                    <Icon icon={iconFor(row)} size="sm" weight={resource.kind === 'PANEL' ? 'regular' : 'duotone'} className={cn(archived && 'opacity-50')} />
                    <span className={cn('min-w-0 flex-1 truncate', archived && 'text-text-muted line-through')}>{localName(resource.name, locale)}</span>
                    {resource.resourceKind === 'SYSTEM' ? <LockSimple className="size-3 shrink-0 text-text-muted" aria-label={t('adm2.views.system')} /> : null}
                    {resource.kind === 'PANEL' ? (
                      <span
                        title={resource.hasUnpublishedChanges ? t('adm2.views.status.unpublished') : t(`adm2.views.status.${resource.status}` as never)}
                        aria-label={resource.hasUnpublishedChanges ? t('adm2.views.status.unpublished') : t(`adm2.views.status.${resource.status}` as never)}
                        className={cn('size-2 shrink-0 rounded-full', resource.status === 'PUBLISHED' ? 'bg-success' : resource.status === 'DRAFT' ? 'bg-text-muted' : 'border border-text-muted', resource.hasUnpublishedChanges && 'ring-2 ring-warning/60')}
                      />
                    ) : <span className="shrink-0 rounded bg-surface-active px-1.5 text-[10px] tabular-nums text-text-muted">{resource.childCount}</span>}
                    <button
                      type="button" tabIndex={-1} aria-label={t('adm2.views.actions')} aria-haspopup="menu"
                      onClick={(event) => { event.stopPropagation(); const box = event.currentTarget.getBoundingClientRect(); onSelect(resource); openMenuAt(resource, box.left, box.bottom + 2); }}
                      className="grid size-5 shrink-0 place-items-center rounded text-text-muted opacity-0 transition-opacity duration-(--duration-fast) hover:bg-surface-active hover:text-text focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100"
                    ><DotsThree weight="bold" className="size-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {menu ? <ContextMenu x={menu.x} y={menu.y} label={t('adm2.views.actions')} items={menuFor(menu.resource)} onClose={(restoreFocus) => { const id = menu.resource.id; setMenu(null); if (restoreFocus) focusRow(id); }} /> : null}
    </div>
  );
}
