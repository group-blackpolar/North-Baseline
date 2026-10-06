import { useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { SidebarSimple } from '@phosphor-icons/react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { usePermissions } from '@/context/PermissionContext';
import { resolveIcon } from '@/lib/iconMap';
import { useI18n } from '@/lib/i18n';
import { useCategoryNavigation } from '@/lib/shellNavigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const PINNED_KEY = 'north-category-rail-pinned';
const LEGACY_EXPANDED_KEY = 'north-category-rail-expanded';

function readPinnedPreference() {
  try {
    const stored = localStorage.getItem(PINNED_KEY);
    if (stored !== null) return stored === '1';
    return localStorage.getItem(LEGACY_EXPANDED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Renders the category rail together with the panel that belongs to it (the
 * subcategory sidebar, passed as `children`) as ONE flex group. When the rail
 * widens on hover the sibling panel is carried with it, instead of staying behind
 * at a stale offset. A temporary (hover/keyboard) expansion overlays the content
 * through a negative end margin, so the main area is not re-laid-out on every
 * hover; pinning grows the group's real width and the main area adapts. */
export function CategoryRail({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  const { categories, isLoading } = useCatalog();
  const { activeTab } = useTabs();
  const goToCategory = useCategoryNavigation();
  const { can } = usePermissions();
  const [pinned, setPinned] = useState(readPinnedPreference);
  const [hovered, setHovered] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const temporaryOpen = hovered || keyboardFocus;
  const expanded = pinned || temporaryOpen;
  const activeCategoryId = activeTab?.route.categoryId;

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    // Unpinning returns to the normal collapsed state right away. The pointer is
    // still over the rail (it just clicked the button), so the hover/focus state
    // that accumulated while pinned must not keep it open until a click outside.
    if (!next) {
      setHovered(false);
      setKeyboardFocus(false);
    }
    try {
      localStorage.setItem(PINNED_KEY, next ? '1' : '0');
      localStorage.removeItem(LEGACY_EXPANDED_KEY);
    } catch {
      /* storage unavailable */
    }
  };

  const closeAfterFocusLeaves = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !pinned) {
      setHovered(false);
      setKeyboardFocus(false);
    }
  };

  const growth = 'calc(var(--shell-category-rail-open) - var(--shell-category-rail))';

  return (
    <div
      className={cn(
        'relative z-30 flex h-full shrink-0 transition-[margin] duration-[var(--shell-motion)] ease-out motion-reduce:transition-none',
        temporaryOpen && !pinned && 'shadow-pop'
      )}
      style={{ marginRight: temporaryOpen && !pinned ? `calc(${growth} * -1)` : 0 }}
    >
      <nav
        aria-label={t('shell.categories')}
        className="shrink-0 bg-surface border-r border-border flex flex-col py-2 gap-1 overflow-hidden transition-[width] duration-[var(--shell-motion)] ease-out motion-reduce:transition-none"
        style={{ width: expanded ? 'var(--shell-category-rail-open)' : 'var(--shell-category-rail)' }}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onFocus={(event) => { if ((event.target as HTMLElement).matches(':focus-visible')) setKeyboardFocus(true); }}
        onBlur={closeAfterFocusLeaves}
        onKeyDown={handleKeyDown}
      >
        {expanded && (
          <div className="flex h-8 shrink-0 items-center px-3">
            <span className="ui-label truncate">{t('shell.categories')}</span>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col items-center gap-1 px-2">
            <Skeleton className="size-9 rounded-lg" />
            <Skeleton className="size-9 rounded-lg" />
          </div>
        )}

        {!isLoading && categories.map((category) => {
          const Icon = resolveIcon(category.icon);
          const active = category.id === activeCategoryId;
          const disabled = Boolean(category.requiredPermission && !can(category.requiredPermission));
          const label = category.id === 'platform-administration'
            ? t('personal.administration')
            : category.id === 'home'
              ? t('personal.home')
              : category.id === 'profile'
                ? t('personal.profile')
                : category.id === 'settings'
                  ? t('home.settings')
                  : category.name;

          return (
            <Tooltip key={category.id} label={expanded ? '' : label} side="right">
            <button
              type="button"
              aria-label={label}
              disabled={disabled}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'mx-2 h-9 shrink-0 rounded-lg flex items-center gap-2.5 transition-colors duration-[var(--shell-motion-fast)]',
                expanded ? 'w-[calc(100%_-_1rem)] px-2.5' : 'w-9 justify-center px-0',
                disabled
                  ? 'text-text-muted opacity-40 cursor-not-allowed'
                  : active
                    ? 'bg-surface-active text-text shadow-soft ring-1 ring-border'
                    : 'text-text-secondary hover:bg-surface-hover hover:text-text'
              )}
              onClick={() => { if (!disabled) goToCategory(category); }}
            >
              <Icon className="size-4 shrink-0" />
              {expanded && <span className="text-xs font-medium truncate">{label}</span>}
            </button>
            </Tooltip>
          );
        })}

        <div className={cn('mt-auto flex shrink-0 items-center py-1.5', expanded ? 'px-2' : 'justify-center')}>
          {/* One button, one icon, one place: it only toggles the fixed state. */}
          <button
            type="button"
            title={pinned ? t('shell.unpinCategories') : t('shell.pinCategories')}
            aria-label={pinned ? t('shell.unpinCategories') : t('shell.pinCategories')}
            aria-pressed={pinned}
            className={cn(
              'size-8 shrink-0 rounded-lg flex items-center justify-center transition-colors duration-[var(--shell-motion-fast)]',
              pinned ? 'bg-accent-soft text-accent' : 'text-text-muted hover:bg-surface-hover hover:text-text'
            )}
            onClick={togglePinned}
          >
            <SidebarSimple className="size-4" />
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
