import { useEffect, useMemo, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { ArrowRight, Buildings, MagnifyingGlass } from '@phosphor-icons/react';
import { portalContainer } from '@/components/ui/portal';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { resolveIcon } from '@/lib/iconMap';
import { useI18n } from '@/lib/i18n';
import { useCategoryNavigation, useOrganizationNavigation } from '@/lib/shellNavigation';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { cn } from '@/lib/utils';

export const OPEN_SEARCH_EVENT = 'north:search-open';

type Result = { id: string; label: string; hint: string; icon: ReturnType<typeof resolveIcon>; run: () => void };

/**
 * One search for the whole shell (UX-01c): destinations of the catalog the user can already reach, and their organizations.
 * It never reads content; what is listed is what the sidebar would show, so authorization is unchanged.
 */
export function GlobalSearch() {
  const { t } = useI18n();
  const { categories } = useCatalog();
  const { organizations, activeOrganization } = useOrganization();
  const { canNavigate } = usePermissions();
  const goToCategory = useCategoryNavigation();
  const goToOrganization = useOrganizationNavigation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => {
    const show = () => { setQuery(''); setActive(0); setOpen(true); };
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); show(); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener(OPEN_SEARCH_EVENT, show); };
  }, []);

  const results = useMemo<Result[]>(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const destinations = categories
      .filter((category) => !category.requiredPermission || canNavigate(category.requiredPermission))
      .flatMap((category) => category.subcategories
        .filter((sub) => !sub.requiredPermission || canNavigate(sub.requiredPermission))
        .map((sub): Result => {
          const name = sub.labelKey ? t(sub.labelKey as never) : sub.name;
          const categoryName = category.id === 'home' ? t('personal.home') : category.id === 'profile' ? t('personal.profile') : category.id === 'settings' ? t('home.settings') : category.id === 'platform-administration' ? t('personal.administration') : category.name;
          return { id: `${category.id}/${sub.id}`, label: name, hint: categoryName, icon: resolveIcon(sub.icon), run: () => goToCategory(category, sub) };
        }));
    const orgs = organizations.filter((organization) => organization.id !== PERSONAL_ORG_ID && organization.id !== activeOrganization?.id).map((organization): Result => ({
      id: `org/${organization.id}`, label: organization.name, hint: t('home.organizationResult'), icon: Buildings as unknown as Result['icon'], run: () => goToOrganization(organization),
    }));
    return [...destinations, ...orgs].filter((item) => !normalized || `${item.label} ${item.hint}`.toLocaleLowerCase().includes(normalized)).slice(0, 12);
  }, [activeOrganization?.id, canNavigate, categories, goToCategory, goToOrganization, organizations, query, t]);

  const choose = (item: Result | undefined) => { if (!item) return; setOpen(false); item.run(); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActive((index) => Math.min(index + 1, results.length - 1)); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); setActive((index) => Math.max(index - 1, 0)); }
    else if (event.key === 'Enter') { event.preventDefault(); choose(results[active]); }
  };

  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal container={portalContainer()}>
        <D.Overlay className="np-overlay fixed inset-0 z-(--z-modal) bg-[#0B1530]/45 backdrop-blur-[3px]" />
        <D.Content aria-describedby={undefined} className="np-dialog fixed left-1/2 top-[14vh] z-(--z-modal) w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-overlay outline-none">
          <D.Title className="sr-only">{t('search.title')}</D.Title>
          <div className="flex items-center gap-3 border-b border-border px-4">
            <MagnifyingGlass className="size-4 shrink-0 text-text-muted" />
            <input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder={t('search.placeholder', { name: activeOrganization?.name ?? 'NORTH' })} aria-label={t('search.title')} className="h-12 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted" />
            <kbd className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">Esc</kbd>
          </div>
          <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
            {results.length === 0 ? <li className="px-3 py-8 text-center text-sm text-text-secondary">{t('home.noSearchResults')}</li> : results.map((item, index) => {
              const Glyph = item.icon;
              return (
                <li key={item.id} role="option" aria-selected={index === active}>
                  <button type="button" onMouseEnter={() => setActive(index)} onClick={() => choose(item)} className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-(--duration-fast)', index === active ? 'bg-accent-soft' : 'hover:bg-surface-hover')}>
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-active text-text-secondary"><Glyph className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-text">{item.label}</span><span className="block truncate text-xs text-text-secondary">{item.hint}</span></span>
                    {index === active ? <ArrowRight className="size-3.5 text-polar" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
