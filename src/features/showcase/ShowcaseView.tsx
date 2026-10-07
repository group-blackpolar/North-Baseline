import { useEffect, useMemo, useState } from 'react';
import { SignIn } from '@phosphor-icons/react';
import { NorthIcon } from '@/components/brand/NorthLogo';
import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GenericNotFound } from '@/components/organization/OrganizationAccessGate';
import { useI18n } from '@/lib/i18n';
import { pushPath, replacePath, type NorthRoute } from '@/lib/routes';
import { getShowcaseNavigation, resolveShowcasePanel, type ShowcaseNavigation } from '@/lib/showcase';
import type { ResolvedPanel } from '@/lib/organizations';
import { PublishedPanel } from '@/views/ViewsRenderer';
import { cn } from '@/lib/utils';
import { ShowcaseContext } from './ShowcaseContext';

type ShowcaseRoute = Extract<NorthRoute, { kind: 'showcase' }>;

function label(names: Record<string, string> | undefined, locale: string) {
  if (!names) return '';
  return names[locale] ?? names.es ?? names.en ?? Object.values(names)[0] ?? '';
}

const pathFor = (slug: string, category: string, subcategory: string, panel: string) => `/showcase/${slug}/${category}/${subcategory}/${panel}`;

/**
 * Anonymous public shell. It deliberately has no Organization Rail, tabs,
 * administration or tenant resources: only the organization identity, the
 * server-filtered public navigation, one published view and a sign-in CTA.
 */
export function ShowcaseView({ route }: { route: ShowcaseRoute }) {
  const { t, locale, setLocale } = useI18n();
  const slug = route.organizationSlug;
  const [navigation, setNavigation] = useState<ShowcaseNavigation | null>(null);
  const [navFailed, setNavFailed] = useState(false);
  const [resolved, setResolved] = useState<ResolvedPanel | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setNavigation(null); setNavFailed(false);
    void getShowcaseNavigation(slug).then((value) => { if (live) setNavigation(value); }).catch(() => { if (live) setNavFailed(true); });
    return () => { live = false; };
  }, [slug]);

  const firstPath = useMemo(() => {
    const category = navigation?.navigation[0];
    const subcategory = category?.subcategories[0];
    const panel = subcategory?.panels[0];
    return category && subcategory && panel ? pathFor(slug, category.slug, subcategory.slug, panel.slug) : null;
  }, [navigation, slug]);

  // `/showcase/:org` lands on the first public view.
  useEffect(() => { if (!route.panel && firstPath) replacePath(firstPath); }, [route.panel, firstPath]);

  const panelKey = route.panel ? `${route.panel.categorySlug}/${route.panel.subcategorySlug}/${route.panel.panelSlug}` : null;
  useEffect(() => {
    if (!route.panel) { setResolved(null); return; }
    let live = true;
    setResolved(null); setPanelFailed(false);
    void resolveShowcasePanel(slug, route.panel)
      .then((value) => { if (live) setResolved(value); })
      .catch(() => { if (live) setPanelFailed(true); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, panelKey]);

  if (navFailed) return <GenericNotFound />;

  const entries = (navigation?.navigation ?? []).flatMap((category) => category.subcategories.map((subcategory) => ({
    key: `${category.id}:${subcategory.id}`,
    category: label(category.name, locale),
    name: label(subcategory.name, locale),
    path: pathFor(slug, category.slug, subcategory.slug, subcategory.panels[0].slug),
    active: route.panel?.categorySlug === category.slug && route.panel.subcategorySlug === subcategory.slug,
  })));
  const current = entries.find((entry) => entry.active);
  const revision = resolved?.revision ?? null;
  const order = revision ? [revision.locale.resolved, ...revision.locale.fallbackChain, revision.defaultLocale] : [];

  return (
    <ShowcaseContext.Provider value={slug}>
      <div className="north-app-shell flex flex-col bg-background text-text">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <NorthIcon className="size-7" />
          <h1 className="font-display text-sm font-semibold">{navigation?.organization.name ?? slug.toUpperCase()}</h1>
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">{t('showcase.badge')}</span>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSelector value={locale} onChange={(code) => setLocale(code as 'es' | 'en')} />
            <ThemeToggle language={locale === 'en' ? 'en' : 'es'} />
            <Button variant="accent" size="sm" onClick={() => pushPath('/')}><SignIn className="size-4" />{t('showcase.signIn')}</Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <nav aria-label={t('showcase.menu')} className="hidden w-60 shrink-0 overflow-y-auto border-r border-border bg-surface p-2 md:block">
            {!navigation ? <div className="space-y-2 p-2"><Skeleton className="h-6 w-full" /><Skeleton className="h-6 w-4/5" /><Skeleton className="h-6 w-3/5" /></div> : (
              navigation.navigation.map((category) => (
                <div key={category.id} className="mb-3 space-y-0.5">
                  <p className="ui-label px-2 py-1">{label(category.name, locale)}</p>
                  {category.subcategories.map((subcategory) => {
                    const active = route.panel?.categorySlug === category.slug && route.panel.subcategorySlug === subcategory.slug;
                    return (
                      <button key={subcategory.id} type="button" aria-current={active ? 'page' : undefined}
                        onClick={() => pushPath(pathFor(slug, category.slug, subcategory.slug, subcategory.panels[0].slug))}
                        className={cn('w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors duration-(--duration-fast)', active ? 'bg-surface-active font-medium text-text' : 'text-text-secondary hover:bg-surface-hover hover:text-text')}>
                        {label(subcategory.name, locale)}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
            <p className="mt-4 px-2 text-[11px] leading-relaxed text-text-muted">{t('showcase.fictional')}</p>
          </nav>
          <main className="min-w-0 flex-1 overflow-y-auto">
            {entries.length > 0 && (
              <div className="p-3 md:hidden">
                <select aria-label={t('showcase.menu')} value={current?.path ?? ''} onChange={(event) => pushPath(event.target.value)}
                  className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm">
                  {entries.map((entry) => <option key={entry.key} value={entry.path}>{entry.category} · {entry.name}</option>)}
                </select>
              </div>
            )}
            {panelFailed ? <p role="alert" className="p-6 text-sm text-text-secondary">{t('showcase.unavailable')}</p>
              : navigation && entries.length === 0 ? <p className="p-6 text-sm text-text-secondary">{t('showcase.empty')}</p>
              : !resolved ? <div aria-busy="true" className="space-y-3 p-4 lg:p-5"><Skeleton className="h-6 w-48" /><Skeleton className="h-40 w-full rounded-xl" /></div>
              : <PublishedPanel key={resolved.panel.id} title={label(resolved.panel.name, locale)} document={revision?.document ?? null} locales={order} organizationId={slug} panelId={resolved.panel.id} />}
          </main>
        </div>
      </div>
    </ShowcaseContext.Provider>
  );
}
