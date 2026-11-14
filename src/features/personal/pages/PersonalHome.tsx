import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { ArrowRight, Buildings, Clock, Gear, MagnifyingGlass, Plus, ShieldCheck, User } from '@phosphor-icons/react';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { useOrganization } from '@/context/OrganizationContext';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { useI18n } from '@/lib/i18n';
import { pushPath } from '@/lib/routes';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { readRecents } from '@/features/home/recents';
import type { SessionUser } from '@/lib/auth';

interface Destination {
  id: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
}

/**
 * Personal Workspace home (UX-01d): a working center, not a menu of shortcuts. A compact header with the search,
 * the user's organizations as cards (with the last time they were used on this device), the tabs still open and the
 * actions that are not already one click away in the sidebar. The page fits the window; only the organizations list scrolls.
 */
export function PersonalHome({ user }: { user: SessionUser }) {
  const { t, locale } = useI18n();
  const { organizations, switchOrganization } = useOrganization();
  const { categories } = useCatalog();
  const { tabs, activeTab, navigate, setActiveTab } = useTabs();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const canAdministerPlatform = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
  type OrgView = (typeof organizations)[number] & { iconAssetId?: string | null; iconData?: string | null; avatarUrl?: string | null; status?: string; description?: string | null; slug?: string };
  const orgs = organizations.filter((organization) => organization.id !== PERSONAL_ORG_ID) as OrgView[];
  const relative = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);

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

  const openOrganization = (organization: { id: string; slug?: string }) => {
    switchOrganization(organization.id);
    if (organization.slug) pushPath(`/${encodeURIComponent(organization.slug)}`);
  };

  /** Last panel opened in each organization on this device (see features/home/recents). */
  const lastUsed = useMemo(() => new Map(orgs.map((organization) => [organization.id, readRecents(user.id, organization.id)[0]?.openedAt ?? null])), [orgs, user.id]);
  const ago = (time: number) => {
    const seconds = Math.round((time - Date.now()) / 1000);
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86_400], ['hour', 3_600], ['minute', 60]];
    for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
    return relative.format(0, 'second');
  };

  const actions = useMemo<Destination[]>(() => {
    const items: Destination[] = [
      { id: 'add', label: t('org.add'), description: t('home.addOrganizationHint'), icon: Plus, action: () => setCreating(true) },
      { id: 'profile', label: t('personal.profile'), description: t('home.profileHint'), icon: User, action: () => navigate('profile', 'personal-information') },
      { id: 'settings', label: t('home.settings'), description: t('home.settingsHint'), icon: Gear, action: () => navigate('settings', 'appearance') },
    ];
    if (canAdministerPlatform) items.push({ id: 'administration', label: t('personal.administration'), description: t('home.administrationHint'), icon: ShieldCheck, action: () => pushPath('/workspace/admin/dashboard') });
    return items;
  }, [canAdministerPlatform, navigate, t]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const organizationResults: Destination[] = orgs.map((organization) => ({
      id: `organization-${organization.id}`,
      label: organization.name,
      description: t('home.organizationResult'),
      icon: Buildings,
      action: () => openOrganization(organization),
    }));
    return [...actions, ...organizationResults]
      .filter((item) => `${item.label} ${item.description}`.toLocaleLowerCase().includes(normalized))
      .slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, orgs, query, t]);

  const openTabs = tabs.filter((tab) => tab.id !== activeTab?.id);

  return (
    <main className="@container oh-bg h-full w-full overflow-y-auto @[60rem]:overflow-hidden">
      <div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-3 p-3 @[40rem]:p-4 @[60rem]:h-full @[60rem]:min-h-0">
        <header className="relative isolate shrink-0 rounded-2xl bg-navy text-white shadow-[0_2px_4px_rgb(10_20_40/0.25),0_22px_44px_-14px_rgb(21_34_59/0.65)] ring-1 ring-white/5">
          <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden rounded-2xl">
            <img src="/brand/port-hero.webp" alt="" decoding="async" fetchPriority="low" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 size-full object-cover object-[72%_52%]" />
            <div className="absolute inset-0 bg-gradient-to-r from-navy from-25% via-navy/92 via-45% to-navy/10" />
            <div className="absolute inset-0 bg-[radial-gradient(520px_240px_at_10%_110%,rgb(52_107_235/0.45),transparent_70%)]" />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 @[48rem]:px-8 @[48rem]:py-5">
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('personal.workspace.name')}</p>
              <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight drop-shadow-[0_2px_16px_rgb(0_0_0/0.35)]">{t('home.heading', { name: user.name?.split(' ')[0] ?? user.email })}</h1>
              <p className="mt-1 hidden text-sm text-white/80 [@media(min-height:820px)]:block">{t('home.subheading')}</p>
            </div>
            <div className="relative w-full max-w-md">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/60" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('home.searchPlaceholder')}
                aria-label={t('home.searchLabel')}
                className="h-11 w-full rounded-xl border-0 bg-white/12 pl-10 pr-16 text-sm text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25),0_8px_18px_-8px_rgb(0_0_0/0.5)] outline-none backdrop-blur-sm placeholder:text-white/60 focus-visible:shadow-[inset_0_0_0_2px_rgb(255_255_255/0.6)]"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-white/15 px-1.5 py-0.5 text-[10px] text-white/80 max-md:hidden">Ctrl K</kbd>
              {query.trim() && (
                <div role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-20 rounded-xl border border-border bg-surface p-1.5 text-text shadow-pop">
                  {searchResults.length > 0 ? searchResults.map((item) => (
                    <button key={item.id} type="button" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-hover" onClick={() => { item.action(); setQuery(''); }}>
                      <item.icon className="size-4 shrink-0 text-text-muted" />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-text">{item.label}</span><span className="block truncate text-xs text-text-secondary">{item.description}</span></span>
                      <ArrowRight className="size-3.5 text-text-muted" />
                    </button>
                  )) : <p className="px-3 py-4 text-center text-xs text-text-muted">{t('home.noSearchResults')}</p>}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-1 gap-3 @[60rem]:flex-1 @[60rem]:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="oh-card flex min-h-0 min-w-0 flex-col p-4">
            <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-text"><Buildings size={17} weight="duotone" className="text-polar" aria-hidden="true" />{t('home.organizations')}</h2>
              <span className="text-xs text-text-muted">{orgs.length === 1 ? t('home.organizationsOne') : t('home.organizationsCount', { n: orgs.length })}</span>
            </div>
            {orgs.length > 0 ? (
              <ul className="-m-1 grid min-h-0 grid-cols-1 content-start gap-3 overflow-y-auto p-1 @[34rem]:grid-cols-2 @[56rem]:grid-cols-3">
                {orgs.map((organization) => {
                  const last = lastUsed.get(organization.id);
                  return (
                    <li key={organization.id} className="min-w-0">
                      <button type="button" onClick={() => openOrganization(organization)} className="group/org flex h-full w-full flex-col gap-3 rounded-[14px] bg-gradient-to-b from-surface to-surface-hover/60 p-3.5 text-left shadow-[0_0_0_1px_var(--color-border),0_2px_4px_rgb(16_32_66/0.06),0_14px_24px_-14px_rgb(30_58_138/0.4)] transition-[box-shadow,transform] duration-(--duration-fast) hover:-translate-y-0.5 hover:shadow-pop">
                        <span className="flex items-center gap-3">
                          <OrganizationAvatar name={organization.name} organizationId={organization.id} iconAssetId={organization.iconAssetId} iconData={organization.iconData ?? organization.avatarUrl} className="size-11 rounded-xl text-sm" />
                          <span className="min-w-0 flex-1 leading-tight">
                            <span className="block truncate font-display text-[15px] font-extrabold text-text">{organization.name}</span>
                            <span className="block truncate text-[11.5px] text-text-secondary">{organization.description || organization.slug || ''}</span>
                          </span>
                        </span>
                        <span className="mt-auto flex items-center justify-between gap-2 text-[11.5px] text-text-muted">
                          <span className="inline-flex items-center gap-1.5"><Clock size={13} aria-hidden="true" />{last ? t('home.lastUsed', { when: ago(last) }) : t('home.neverUsed')}</span>
                          {organization.status && organization.status !== 'ACTIVE' ? <span className="rounded-full border border-warning/40 px-2 py-0.5 text-[10.5px] font-semibold text-warning">{organization.status}</span> : null}
                          <span className="inline-flex items-center gap-1 font-semibold text-polar">{t('home.open')}<ArrowRight size={13} weight="bold" className="transition-transform group-hover/org:translate-x-0.5" aria-hidden="true" /></span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                <li className="min-w-0">
                  <button type="button" onClick={() => setCreating(true)} className="flex h-full min-h-24 w-full flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed border-polar/40 bg-gradient-to-b from-accent-soft to-transparent p-3 text-center transition-colors duration-(--duration-fast) hover:border-polar">
                    <span className="grid size-8 place-items-center rounded-full bg-surface text-polar shadow-[0_6px_12px_-6px_rgb(52_107_235/0.6),0_0_0_1px_var(--color-border)]"><Plus size={16} weight="bold" aria-hidden="true" /></span>
                    <span className="font-display text-[14.5px] font-extrabold text-polar">{t('org.add')}</span>
                  </button>
                </li>
              </ul>
            ) : (
              <div className="rounded-lg border border-dashed border-border-strong px-4 py-7 text-center">
                <p className="text-sm font-medium text-text">{t('home.noOrganizations')}</p>
                <p className="mt-1 text-xs text-text-secondary">{t('home.noOrganizationsHint')}</p>
                <button type="button" onClick={() => setCreating(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-1.5 text-sm font-semibold text-white">{t('org.add')}</button>
              </div>
            )}
          </section>

          <aside className="flex min-h-0 min-w-0 flex-col gap-3">
            <section className="oh-card flex min-h-0 flex-col p-4 @[60rem]:flex-1">
              <h2 className="mb-3 flex shrink-0 items-center gap-2 font-display text-[15px] font-bold text-text"><Clock size={17} weight="duotone" className="text-polar" aria-hidden="true" />{t('home.continueWorking')}</h2>
              {openTabs.length > 0 ? (
                <ul className="-mx-1 min-h-0 space-y-0.5 overflow-y-auto">
                  {openTabs.slice(0, 6).map((tab) => {
                    const category = categories.find((item) => item.id === tab.route.categoryId);
                    const subcategory = category?.subcategories.find((item) => item.id === tab.route.subcategoryId);
                    return (
                      <li key={tab.id}>
                        <button type="button" onClick={() => setActiveTab(tab.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface-hover">
                          <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-text">{subcategory?.name ?? category?.name ?? t('home.untitledView')}</span><span className="block truncate text-[11px] text-text-secondary">{category?.name ?? t('personal.workspace.name')}</span></span>
                          <ArrowRight className="size-3.5 text-text-muted" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-text-secondary">{t('home.noOpenWorkHint')}</p>
              )}
            </section>

            <section className="oh-card shrink-0 p-2">
              <ul className="space-y-0.5">
                {actions.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={item.action} className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-polar"><item.icon className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold text-text">{item.label}</span><span className="block truncate text-[11px] text-text-secondary">{item.description}</span></span>
                      <ArrowRight className="size-3.5 text-text-muted transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
      <OrganizationModal open={creating} onClose={() => setCreating(false)} />
    </main>
  );
}
