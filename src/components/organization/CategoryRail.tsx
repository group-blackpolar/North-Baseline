import { useState, type FocusEvent, type KeyboardEvent } from 'react';
import { PanelLeftOpen, Pin, PinOff } from 'lucide-react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { usePermissions } from '@/context/PermissionContext';
import { resolveIcon } from '@/lib/iconMap';
import { pushPath } from '@/lib/routes';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/context/OrganizationContext';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import { Skeleton } from '@/components/ui/skeleton';
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

export function CategoryRail() {
  const { t } = useI18n();
  const { categories, isLoading } = useCatalog();
  const { activeTab, navigate } = useTabs();
  const { activeOrganization } = useOrganization();
  const { can } = usePermissions();
  const [pinned, setPinned] = useState(readPinnedPreference);
  const [temporaryOpen, setTemporaryOpen] = useState(false);
  const expanded = pinned || temporaryOpen;
  const activeCategoryId = activeTab?.route.categoryId;

  const togglePinned = () => {
    setPinned((current) => {
      const next = !current;
      try {
        localStorage.setItem(PINNED_KEY, next ? '1' : '0');
        localStorage.removeItem(LEGACY_EXPANDED_KEY);
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  const closeAfterFocusLeaves = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setTemporaryOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && !pinned) {
      setTemporaryOpen(false);
    }
  };

  return (
    <div
      className="relative shrink-0 h-full transition-[width] duration-[var(--shell-motion)] ease-out"
      style={{ width: pinned ? 'var(--shell-category-rail-open)' : 'var(--shell-category-rail)' }}
    >
      <nav
        aria-label={t('shell.categories')}
        className={cn(
          'absolute inset-y-0 left-0 z-30 bg-surface border-r border-border flex flex-col py-2 gap-1 overflow-hidden',
          'transition-[width,box-shadow] duration-[var(--shell-motion)] ease-out',
          expanded && !pinned && 'shadow-pop'
        )}
        style={{ width: expanded ? 'var(--shell-category-rail-open)' : 'var(--shell-category-rail)' }}
        onPointerEnter={() => setTemporaryOpen(true)}
        onPointerLeave={(event) => {
          if (!pinned && !event.currentTarget.contains(document.activeElement)) setTemporaryOpen(false);
        }}
        onFocus={() => setTemporaryOpen(true)}
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
            <button
              key={category.id}
              type="button"
              title={label}
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
              onClick={() => {
                if (disabled) return;
                if (category.id === 'platform-administration') {
                  pushPath('/workspace/admin/dashboard');
                  return;
                }
                const subcategory = category.subcategories[0];
                void navigateToPublishedTarget({
                  organizationSlug: activeOrganization?.slug,
                  category,
                  subcategory,
                  navigate,
                  history: 'push',
                }).catch(() => navigate(category.id, subcategory?.id ?? null));
              }}
            >
              <Icon className="size-4 shrink-0" />
              {expanded && <span className="text-xs font-medium truncate">{label}</span>}
            </button>
          );
        })}

        <div className={cn('mt-auto flex shrink-0 items-center py-1.5', expanded ? 'gap-1.5 px-2' : 'justify-center')}>
          <button
            type="button"
            title={pinned ? t('shell.unpinCategories') : t('shell.pinCategories')}
            aria-label={pinned ? t('shell.unpinCategories') : t('shell.pinCategories')}
            aria-pressed={pinned}
            className="size-8 shrink-0 rounded-lg flex items-center justify-center text-text-muted hover:bg-surface-hover hover:text-text transition-colors duration-[var(--shell-motion-fast)]"
            onClick={togglePinned}
          >
            {pinned ? <PinOff className="size-4" /> : expanded ? <Pin className="size-4" /> : <PanelLeftOpen className="size-4" />}
          </button>
          {expanded && !pinned && (
            <span className="min-w-0 truncate text-[10px] text-text-muted">{t('shell.overlayHint')}</span>
          )}
          {expanded && pinned && (
            <span className="min-w-0 truncate text-[10px] text-text-muted">{t('shell.pinned')}</span>
          )}
        </div>
      </nav>
    </div>
  );
}
