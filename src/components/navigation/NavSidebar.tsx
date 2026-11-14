import { useEffect, useMemo, useState } from 'react';
import { CaretDown, CaretRight, MagnifyingGlass, SidebarSimple } from '@phosphor-icons/react';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useTabs } from '@/context/TabsContext';
import { Collapse } from '@/components/ui/collapse';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { ProfileMenu } from '@/components/sidebar/ProfileMenu';
/** The navigation is always dark, so it uses the white mark regardless of theme. */
const NavMark = ({ className }: { className?: string }) => <img src="/white512.png" alt="" aria-hidden="true" className={cn('shrink-0 object-contain', className)} />;
import { OrganizationSwitcher } from '@/components/organization/OrganizationSwitcher';
import { resolveIcon } from '@/lib/iconMap';
import { useI18n } from '@/lib/i18n';
import { useCategoryNavigation } from '@/lib/shellNavigation';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';
import type { CategoryModel, SubcategoryModel } from '@/lib/models';

/**
 * One navigation bar for the whole catalog (UX-01c, option B): categories are collapsible group headers, the groups of a
 * category are labels, subcategories are the rows. Collapsed, it is an icon rail and each category opens a flyout.
 * The hierarchy is the catalog's own (View Studio creates it for organizations; the personal workspace defines its own).
 */
const COLLAPSED_KEY = 'north-nav-collapsed-v1';
const OPEN_KEY = 'north-nav-open-v1';

const readFlag = (key: string, fallback: boolean) => {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
};
const readOpen = (scope: string): Record<string, boolean> => {
  try {
    return JSON.parse(localStorage.getItem(`${OPEN_KEY}:${scope}`) ?? '{}') as Record<string, boolean>;
  } catch {
    return {};
  }
};

type Translate = (key: never) => string;

/** Names the catalog does not translate itself (the personal workspace categories). */
function useCategoryLabel() {
  const { t } = useI18n();
  return (category: CategoryModel) => {
    switch (category.id) {
      case 'platform-administration': return t('personal.administration');
      case 'home': return t('personal.home');
      case 'profile': return t('personal.profile');
      case 'settings': return t('home.settings');
      default: return category.name;
    }
  };
}

function groupsOf(category: CategoryModel, query: string, label: (sub: SubcategoryModel) => string) {
  const map = new Map<string, { name: string; key?: string; items: SubcategoryModel[] }>();
  for (const sub of category.subcategories) {
    if (query && !label(sub).toLowerCase().includes(query)) continue;
    const id = sub.group ?? '';
    const entry = map.get(id) ?? { name: id, key: sub.groupKey, items: [] };
    entry.items.push(sub);
    map.set(id, entry);
  }
  return [...map.values()];
}

function Row({ sub, category, active, label, onGo, size }: { sub: SubcategoryModel; category: CategoryModel; active: boolean; label: string; onGo: (category: CategoryModel, sub: SubcategoryModel) => void; size: 'row' | 'flyout' }) {
  const { canNavigate } = usePermissions();
  const Icon = resolveIcon(sub.icon);
  const disabled = Boolean(sub.requiredPermission && !canNavigate(sub.requiredPermission));
  return (
    <button
      type="button"
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      title={label}
      onClick={() => onGo(category, sub)}
      className={cn(
        'np-press-flat flex h-(--nav-row-h) w-full items-center gap-2 rounded-md pr-2 text-[13px] transition-colors duration-(--shell-motion-fast)',
        size === 'row' ? 'pl-7' : 'pl-2',
        disabled ? 'cursor-not-allowed text-text-muted opacity-50' : active ? 'bg-surface-active font-medium text-text' : 'text-text-secondary hover:bg-surface-hover hover:text-text',
      )}
    >
      <Icon weight={active ? 'fill' : 'regular'} className="size-4 shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function NavSidebar({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const tr = t as unknown as Translate;
  const { categories, isLoading } = useCatalog();
  const { activeOrganization } = useOrganization();
  const { activeTab } = useTabs();
  const { canNavigate } = usePermissions();
  const goToCategory = useCategoryNavigation();
  const categoryLabel = useCategoryLabel();
  const scope = activeOrganization?.id ?? 'none';
  const [collapsed, setCollapsed] = useState(() => readFlag(COLLAPSED_KEY, false));
  const [open, setOpen] = useState(() => readOpen(scope));
  const [search, setSearch] = useState('');
  // Fixed-position flyout: the rail scrolls, so an absolutely positioned child would be clipped.
  const [flyout, setFlyout] = useState<{ id: string; top: number; left: number } | null>(null);
  const activeCategoryId = activeTab?.route.categoryId;
  const activeSubId = activeTab?.route.subcategoryId;
  const query = search.trim().toLowerCase();
  const subLabel = (sub: SubcategoryModel) => (sub.labelKey ? tr(sub.labelKey as never) : sub.name);

  useEffect(() => {
    try { localStorage.setItem(`${OPEN_KEY}:${scope}`, JSON.stringify(open)); } catch { /* storage unavailable */ }
  }, [open, scope]);

  useEffect(() => {
    if (!flyout) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === 'Escape') setFlyout(null); return; }
      if (!(event.target as Element).closest('[data-nav-flyout]')) setFlyout(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [flyout]);

  const setCollapsedFlag = (next: boolean) => {
    setCollapsed(next);
    setFlyout(null);
    try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch { /* storage unavailable */ }
  };
  // The active category is open unless the user closed it explicitly; the others stay closed until opened.
  const isOpen = (category: CategoryModel) => (query ? true : open[category.id] ?? category.id === activeCategoryId);
  const toggle = (category: CategoryModel) => setOpen((current) => ({ ...current, [category.id]: !isOpen(category) }));
  const go = (category: CategoryModel, sub: SubcategoryModel) => { setFlyout(null); goToCategory(category, sub); };

  const visible = useMemo(() => categories.filter((category) => !category.requiredPermission || canNavigate(category.requiredPermission)), [categories, canNavigate]);

  const toggleButton = (
    <button
      type="button"
      aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
      aria-pressed={collapsed}
      onClick={() => setCollapsedFlag(!collapsed)}
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors duration-(--shell-motion-fast) hover:bg-surface-hover hover:text-text"
    >
      <SidebarSimple className="size-4" />
    </button>
  );

  if (collapsed) {
    return (
      <aside aria-label={t('shell.categories')} className="north-nav-dark relative z-(--z-navigation) flex h-full shrink-0 flex-col items-center gap-1 border-r border-border py-2" style={{ width: 'var(--shell-category-rail)' }}>
        <NavMark className="size-8" />
        <OrganizationSwitcher collapsed />
        {toggleButton}
        <div className="my-0.5 h-px w-6 bg-border" />
        <nav className="flex w-full flex-1 flex-col items-center gap-1 overflow-y-auto" aria-label={t('shell.categories')}>
          {isLoading && <Skeleton className="size-9 rounded-lg" />}
          {visible.map((category) => {
            const Icon = resolveIcon(category.icon);
            const active = category.id === activeCategoryId;
            const label = categoryLabel(category);
            return (
              <div key={category.id}>
                <Tooltip label={flyout?.id === category.id ? '' : label} side="right">
                  <button
                    type="button"
                    data-nav-flyout
                    aria-label={label}
                    aria-haspopup="menu"
                    aria-expanded={flyout?.id === category.id}
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setFlyout(flyout?.id === category.id ? null : { id: category.id, top: rect.top, left: rect.right + 8 });
                    }}
                    className={cn('flex size-9 items-center justify-center rounded-lg transition-colors duration-(--shell-motion-fast)', active ? 'bg-surface-active text-text ring-1 ring-border' : 'text-text-secondary hover:bg-surface-hover hover:text-text')}
                  >
                    <Icon weight={active ? 'fill' : 'regular'} className="size-5" style={category.color ? { color: category.color } : undefined} />
                  </button>
                </Tooltip>
                {flyout?.id === category.id && (
                  <div role="menu" data-nav-flyout aria-label={label} style={{ top: flyout.top, left: flyout.left }} className="fixed z-(--z-popover) w-56 rounded-lg border border-border bg-surface p-1.5 shadow-pop north-enter">
                    <p className="ui-label truncate px-2 py-1.5">{label}</p>
                    {groupsOf(category, '', subLabel).map((group) => (
                      <div key={group.name} className="space-y-0.5">
                        {group.name && <p className="px-2 pt-1.5 text-[11px] text-text-muted">{group.key ? tr(group.key as never) : group.name}</p>}
                        {group.items.map((sub) => (
                          <Row key={sub.id} sub={sub} category={category} size="flyout" label={subLabel(sub)} active={category.id === activeCategoryId && sub.id === activeSubId} onGo={go} />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <Tooltip label="Powered by Black Polar" side="right">
          <span className="mb-1 flex size-8 items-center justify-center text-[9px] font-semibold tracking-wider text-text-muted" aria-label="Powered by Black Polar">BP</span>
        </Tooltip>
      </aside>
    );
  }

  return (
    <aside aria-label={t('shell.categories')} className="north-nav-dark relative z-(--z-navigation) flex h-full shrink-0 flex-col overflow-hidden border-r border-border" style={{ width: 'var(--shell-context-sidebar)' }}>
      <header className="shrink-0 space-y-2.5 border-b border-border p-2.5">
        <div className="flex items-center gap-2 px-0.5">
          <NavMark className="size-8" />
          <span className="min-w-0 flex-1 leading-none">
            <span className="block text-[9px] font-semibold uppercase tracking-[0.16em] text-text-muted">Black Polar<sup>®</sup></span>
            <span className="block font-display text-lg font-bold tracking-[0.08em] text-text">NORTH</span>
          </span>
          {toggleButton}
        </div>
        <OrganizationSwitcher collapsed={false} />
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlass className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('sidebar.search')}
              aria-label={t('sidebar.search')}
              className="h-8 w-full rounded-md border border-border bg-surface pl-7 pr-2 text-xs text-text outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            />
          </div>
        </div>
      </header>

      <nav aria-label={t('shell.categories')} className="flex-1 space-y-1 overflow-y-auto p-2">
        {isLoading && <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-2/3" /></div>}
        {!isLoading && visible.map((category) => {
          const groups = groupsOf(category, query, subLabel);
          if (query && groups.length === 0) return null;
          const Icon = resolveIcon(category.icon);
          const expanded = isOpen(category);
          const active = category.id === activeCategoryId;
          const label = categoryLabel(category);
          return (
            <section key={category.id} className="space-y-0.5">
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => toggle(category)}
                className={cn('np-press-flat flex h-(--nav-row-h) w-full items-center gap-2 rounded-md px-2 text-left transition-colors duration-(--shell-motion-fast) hover:bg-surface-hover', active ? 'text-text' : 'text-text-secondary hover:text-text')}
              >
                <Icon weight={active ? 'fill' : 'duotone'} className="size-4 shrink-0" style={category.color ? { color: category.color } : undefined} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{label}</span>
                {expanded ? <CaretDown className="size-3 shrink-0 text-text-muted" /> : <CaretRight className="size-3 shrink-0 text-text-muted" />}
              </button>
              <Collapse open={expanded}>
                <div className="ml-4 space-y-0.5 border-l border-border pl-0.5">
                  {groups.map((group) => (
                    <div key={group.name} className="space-y-0.5">
                      {group.name && groups.length > 1 && <p className="ui-label px-2 pb-0.5 pt-2 text-[10px]">{group.key ? tr(group.key as never) : group.name}</p>}
                      {group.items.map((sub) => (
                        <Row key={sub.id} sub={sub} category={category} size="row" label={subLabel(sub)} active={active && sub.id === activeSubId} onGo={go} />
                      ))}
                    </div>
                  ))}
                </div>
              </Collapse>
            </section>
          );
        })}
        {!isLoading && query && !visible.some((category) => groupsOf(category, query, subLabel).length) && (
          <p className="px-2 py-4 text-center text-xs text-text-muted">{t('sidebar.noResults')}</p>
        )}
      </nav>

      <footer className="shrink-0 space-y-1 border-t border-border p-2">
        <ProfileMenu user={user} />
        <p className="px-2 pb-0.5 text-center text-[10px] tracking-wide text-text-muted">Powered by <span className="font-semibold text-text-secondary">Black Polar</span></p>
      </footer>
    </aside>
  );
}
