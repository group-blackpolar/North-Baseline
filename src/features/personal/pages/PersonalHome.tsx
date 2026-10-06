import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ArrowRight, Building2, Clock3, Search, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { useI18n } from '@/lib/i18n';
import { pushPath } from '@/lib/routes';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import type { SessionUser } from '@/lib/auth';

interface Destination {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
}

export function PersonalHome({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { organizations, switchOrganization } = useOrganization();
  const { categories } = useCatalog();
  const { tabs, activeTab, navigate, setActiveTab } = useTabs();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const canAdministerPlatform = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
  const orgs = organizations.filter((organization) => organization.id !== PERSONAL_ORG_ID);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const destinations = useMemo<Destination[]>(() => {
    const items: Destination[] = [
      {
        id: 'profile',
        label: t('personal.profile'),
        description: t('home.profileHint'),
        icon: UserRound,
        action: () => navigate('profile', 'personal-information'),
      },
      {
        id: 'settings',
        label: t('home.settings'),
        description: t('home.settingsHint'),
        icon: Settings,
        action: () => navigate('settings', 'appearance'),
      },
    ];
    if (canAdministerPlatform) {
      items.push({
        id: 'administration',
        label: t('personal.administration'),
        description: t('home.administrationHint'),
        icon: ShieldCheck,
        action: () => pushPath('/workspace/admin/dashboard'),
      });
    }
    return items;
  }, [canAdministerPlatform, navigate, t]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const organizationResults: Destination[] = orgs.map((organization) => ({
      id: `organization-${organization.id}`,
      label: organization.name,
      description: t('home.organizationResult'),
      icon: Building2,
      action: () => {
        switchOrganization(organization.id);
        if (organization.slug) pushPath(`/${encodeURIComponent(organization.slug)}`);
      },
    }));
    return [...destinations, ...organizationResults]
      .filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalized))
      .slice(0, 7);
  }, [destinations, orgs, query, switchOrganization, t]);

  const openTabs = tabs.filter((tab) => tab.id !== activeTab?.id);

  return (
    <main className="mx-auto w-full max-w-[1680px] p-4 lg:p-5 space-y-5">
      <header className="pt-2 text-center">
        <p className="ui-label mb-2">{t('personal.workspace.name')}</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">
          {t('home.heading', { name: user.name?.split(' ')[0] ?? user.email })}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">{t('home.subheading')}</p>
      </header>

      <section aria-label={t('home.searchLabel')} className="relative mx-auto max-w-3xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('home.searchPlaceholder')}
          aria-label={t('home.searchLabel')}
          className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-16 text-sm text-text shadow-soft outline-none placeholder:text-text-muted focus-visible:border-accent"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-text-muted">Ctrl K</kbd>
        {query.trim() && (
          <div className="absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-xl border border-border bg-surface p-1.5 shadow-pop">
            {searchResults.length > 0 ? searchResults.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-hover"
                onClick={() => { item.action(); setQuery(''); }}
              >
                <item.icon className="size-4 shrink-0 text-text-muted" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{item.label}</span>
                  <span className="block truncate text-xs text-text-secondary">{item.description}</span>
                </span>
                <ArrowRight className="size-3.5 text-text-muted" />
              </button>
            )) : (
              <p className="px-3 py-4 text-center text-xs text-text-muted">{t('home.noSearchResults')}</p>
            )}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{t('home.quickAccess')}</h2>
          <span className="text-xs text-text-muted">{t('home.safeDestinations')}</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {destinations.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="group flex min-h-20 items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left shadow-soft transition-[border-color,background-color] duration-[var(--shell-motion-fast)] hover:border-border-strong hover:bg-surface-hover"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <item.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-text">{item.label}</span>
                <span className="mt-0.5 block text-xs text-text-secondary">{item.description}</span>
              </span>
              <ArrowRight className="size-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <section className="rounded-xl border border-border bg-surface p-3 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <Clock3 className="size-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text">{t('home.continueWorking')}</h2>
          </div>
          {openTabs.length > 0 ? (
            <div className="space-y-1">
              {openTabs.slice(0, 5).map((tab) => {
                const category = categories.find((item) => item.id === tab.route.categoryId);
                const subcategory = category?.subcategories.find((item) => item.id === tab.route.subcategoryId);
                return (
                  <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-hover">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text">{subcategory?.name ?? category?.name ?? t('home.untitledView')}</span>
                      <span className="block truncate text-xs text-text-secondary">{category?.name ?? t('personal.workspace.name')}</span>
                    </span>
                    <ArrowRight className="size-3.5 text-text-muted" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-strong px-4 py-7 text-center">
              <p className="text-sm font-medium text-text">{t('home.noOpenWork')}</p>
              <p className="mt-1 text-xs text-text-secondary">{t('home.noOpenWorkHint')}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-3 shadow-soft">
          <div className="mb-2 flex items-center gap-2">
            <Building2 className="size-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text">{t('home.organizations')}</h2>
          </div>
          {orgs.length > 0 ? (
            <div className="space-y-1">
              {orgs.slice(0, 5).map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => {
                    switchOrganization(organization.id);
                    if (organization.slug) pushPath(`/${encodeURIComponent(organization.slug)}`);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-hover"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-active text-xs font-semibold text-text-secondary">
                    {organization.name.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{organization.name}</span>
                  <ArrowRight className="size-3.5 text-text-muted" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border-strong px-4 py-7 text-center">
              <p className="text-sm font-medium text-text">{t('home.noOrganizations')}</p>
              <p className="mt-1 text-xs text-text-secondary">{t('home.noOrganizationsHint')}</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
