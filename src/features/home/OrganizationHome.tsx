import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowUpRight, ChartBar, Database, Files, HardDrives, Package, Sparkle, Users } from '@phosphor-icons/react';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { useI18n } from '@/lib/i18n';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import { cn } from '@/lib/utils';
import type { SessionUser } from '@/lib/auth';
import type { CategoryModel } from '@/lib/models';
import { listMembers } from '@/features/access-admin/api';
import { getStorage, listAuditEntries, listDatasets } from '@/features/admin-center/api';
import { useResource, type Resource } from '@/features/admin-center/hooks';
import { OPEN_ASSISTANT_EVENT } from '@/features/assistant/openEvent';
import { GENERIC_ACCENTS, GENERIC_IMAGES } from './homeReports';
import { fetchPlatformStatus } from './platformStatus';
import { RECENTS_EVENT, readRecents, type Recent } from './recents';
import type { ReportAccessTarget } from './reportAccessApi';

const SYSTEM_CATEGORIES = new Set(['home', 'admin']);

const firstTarget = (category: CategoryModel): ReportAccessTarget | null => {
  const subcategory = category.subcategories.find((item) => item.publishedPanels?.length);
  const panel = subcategory?.publishedPanels?.[0];
  return subcategory && panel && category.slug && subcategory.slug ? { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } : null;
};

function Panel({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('np-card min-w-0 p-3.5', className)}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="font-display text-[15px] font-semibold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Glyph, label, value, hint, state }: { icon: typeof Package; label: string; value: string; hint?: string; state: Resource<unknown>['status'] | 'static' }) {
  return (
    <div className="np-card flex min-w-0 items-center gap-3 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"><Glyph size={20} weight="duotone" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-text-muted">{label}</p>
        {state === 'loading' ? <Skeleton className="mt-1 h-6 w-16" /> : <p className="font-display text-xl font-semibold leading-tight tabular-nums text-text">{value}</p>}
        {hint && state !== 'loading' ? <p className="truncate text-[11px] text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

const formatBytes = (value: string, locale: string) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes; let unit = 0;
  while (size >= 1024 && unit < units.length - 1) { size /= 1024; unit += 1; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: size >= 10 || unit === 0 ? 0 : 1 }).format(size)} ${units[unit]}`;
};

/**
 * Home of an organization workspace (UX-01d). Compact header, only figures CORECROW can actually give this user,
 * the reports its navigation already authorizes, recently opened panels and platform status. A block the user may not
 * see (403/404) is left out, never faked; there are no decorative charts.
 */
export function OrganizationHome({ user }: { user: SessionUser }) {
  const { t, locale } = useI18n();
  const { activeOrganization } = useOrganization();
  const organizationId = activeOrganization?.id ?? '';
  const { categories, isLoading: catalogLoading } = useCatalog();
  const { navigate } = useTabs();
  const [openError, setOpenError] = useState(false);
  const number = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const members = useResource(() => listMembers(organizationId), [organizationId]);
  const datasets = useResource(() => listDatasets(organizationId), [organizationId]);
  const storage = useResource(() => getStorage(organizationId), [organizationId]);
  const audit = useResource(() => listAuditEntries(organizationId, { limit: 20 }), [organizationId]);
  // Reads (including this very Home loading the log) are noise; show what changed.
  const changes = useMemo(() => (audit.data ?? []).filter((entry) => !/(^|[._ ])read$/i.test(entry.action)).slice(0, 5), [audit.data]);
  const platform = useResource(() => fetchPlatformStatus(), []);

  const [recents, setRecents] = useState<Recent[]>(() => readRecents(user.id, organizationId));
  useEffect(() => {
    const refresh = () => setRecents(readRecents(user.id, organizationId));
    refresh();
    window.addEventListener(RECENTS_EVENT, refresh);
    return () => window.removeEventListener(RECENTS_EVENT, refresh);
  }, [user.id, organizationId]);

  const open = useCallback((target: ReportAccessTarget) => {
    const category = categories.find((item) => item.id === target.categoryId);
    if (!category) { setOpenError(true); return; }
    setOpenError(false);
    void navigateToPublishedTarget({ organizationSlug: activeOrganization?.slug, category, subcategory: category.subcategories.find((item) => item.id === target.subcategoryId), navigate, history: 'push', panelSlug: target.panelSlug }).catch(() => setOpenError(true));
  }, [activeOrganization?.slug, categories, navigate]);

  const entries = useMemo(() => categories.filter((category) => category.slug && !SYSTEM_CATEGORIES.has(category.slug)).flatMap((category, index) => {
    const target = firstTarget(category);
    return target ? [{ key: category.id, name: category.name, accent: GENERIC_ACCENTS[index % GENERIC_ACCENTS.length]!, image: GENERIC_IMAGES[index % GENERIC_IMAGES.length]!, target }] : [];
  }), [categories]);

  // Recents are resolved against the current catalog: a panel the user can no longer see is dropped.
  const visibleRecents = useMemo(() => recents.flatMap((recent) => {
    const category = categories.find((item) => item.id === recent.categoryId);
    const subcategory = category?.subcategories.find((item) => item.id === recent.subcategoryId);
    const panel = subcategory?.publishedPanels?.find((item) => item.id === recent.panelId);
    return category && subcategory && panel && category.slug && subcategory.slug
      ? [{ recent, target: { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } satisfies ReportAccessTarget }]
      : [];
  }).slice(0, 6), [recents, categories]);

  const relative = useMemo(() => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }), [locale]);
  const ago = (time: number | string) => {
    const seconds = Math.round((new Date(time).getTime() - Date.now()) / 1000);
    const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86_400], ['hour', 3_600], ['minute', 60]];
    for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
    return relative.format(0, 'second');
  };

  const organizationName = activeOrganization?.name ?? '';
  const firstName = user.name?.trim().split(/\s+/)[0];
  const activeMembers = (members.data ?? []).filter((member) => member.status !== 'SUSPENDED').length;
  const activeDatasets = (datasets.data ?? []).filter((dataset) => (dataset as { status?: string }).status !== 'ARCHIVED').length;
  const used = Number(storage.data?.usedBytes);
  const limit = Number(storage.data?.limitBytes);
  const storagePercent = Number.isFinite(used) && Number.isFinite(limit) && limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : null;
  const shown = (resource: Resource<unknown>) => resource.status === 'ready' || resource.status === 'loading';

  return (
    <div className="@container min-h-full w-full bg-background text-text">
      <div className="mx-auto w-full max-w-[1440px] space-y-3 p-3 @[40rem]:p-4">
        <header className="relative isolate overflow-hidden rounded-xl border border-border bg-surface">
          <img src="/brand/port-hero.webp" alt="" aria-hidden="true" decoding="async" fetchPriority="low" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 -z-20 size-full object-cover object-[70%_55%] opacity-20" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-surface via-surface/85 to-surface/40" />
          <div className="flex flex-wrap items-center gap-3 px-4 py-3">
            <OrganizationAvatar name={organizationName} organizationId={activeOrganization?.id} iconAssetId={(activeOrganization as { iconAssetId?: string | null } | null)?.iconAssetId} iconData={(activeOrganization as { iconData?: string | null } | null)?.iconData} className="size-12 rounded-xl text-lg" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-xl font-bold leading-tight text-text">{firstName ? t('oh2.title', { name: firstName }) : t('oh.title', { name: organizationName })}</h1>
              <p className="truncate text-sm text-text-secondary">{organizationName} · {t('oh.tagline')}</p>
            </div>
            <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))} className="inline-flex h-(--control-h-md) items-center gap-2 rounded-lg bg-ai px-3.5 text-sm font-medium text-white shadow-soft transition-opacity duration-(--duration-fast) hover:opacity-90">
              <Sparkle size={16} weight="fill" aria-hidden="true" />{t('oh2.ai')}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 @[64rem]:grid-cols-4">
          <Kpi icon={ChartBar} label={t('oh2.kpi.reports')} value={number.format(entries.length)} state={catalogLoading ? 'loading' : 'static'} />
          {shown(datasets) && <Kpi icon={Database} label={t('oh2.kpi.datasets')} value={number.format(activeDatasets)} state={datasets.status} />}
          {shown(members) && <Kpi icon={Users} label={t('oh2.kpi.members')} value={number.format(activeMembers)} state={members.status} />}
          {shown(storage) && <Kpi icon={HardDrives} label={t('oh2.kpi.storage')} value={storage.data ? formatBytes(storage.data.usedBytes, locale) : '—'} hint={storagePercent === null ? undefined : t('oh2.kpi.storageOf', { limit: formatBytes(storage.data!.limitBytes, locale), percent: storagePercent })} state={storage.status} />}
        </div>

        <div className="grid grid-cols-1 gap-3 @[64rem]:grid-cols-[minmax(0,1fr)_20rem]">
          <Panel title={t('oh.reports')} action={<span className="text-xs text-text-muted">{t('oh.reportsHint')}</span>} className="@[64rem]:self-start">
            {openError ? <p role="alert" className="mb-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-text">{t('oh.openError')}</p> : null}
            {catalogLoading ? (
              <div className="grid gap-3 @[34rem]:grid-cols-2 @[56rem]:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>
            ) : entries.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-text-secondary">{t('oh.empty')}</p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-2 @[56rem]:grid-cols-3 @[84rem]:grid-cols-4">
                {entries.map((entry, index) => (
                  <li key={entry.key} className="min-w-0">
                    <button type="button" onClick={() => open(entry.target)} style={{ '--accent-card': entry.accent, '--i': index } as React.CSSProperties} className="np-card np-stagger group/card relative flex h-28 w-full flex-col justify-end overflow-hidden p-3 text-left transition-shadow duration-(--duration-fast) hover:shadow-pop">
                      <img src={entry.image} alt="" loading="lazy" decoding="async" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 size-full object-cover opacity-70 transition-transform duration-300 group-hover/card:scale-[1.04]" />
                      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-transparent" />
                      <span className="relative flex items-center justify-between gap-2">
                        <span className="truncate font-display text-[15px] font-semibold text-text">{entry.name}</span>
                        <ArrowUpRight size={16} weight="bold" aria-hidden="true" className="shrink-0" style={{ color: entry.accent }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <aside className="min-w-0 space-y-3">
            <Panel title={t('oh2.recents')}>
              {visibleRecents.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('oh2.recentsEmpty')}</p>
              ) : (
                <ul className="-mx-1 space-y-0.5">
                  {visibleRecents.map(({ recent, target }) => (
                    <li key={recent.panelId}>
                      <button type="button" onClick={() => open(target)} className="np-press-flat flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-active text-text-secondary"><Files size={15} weight="duotone" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{recent.title}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(recent.openedAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {audit.status === 'ready' && changes.length > 0 && (
              <Panel title={t('oh2.activity')}>
                <ul className="space-y-1.5">
                  {changes.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-2 text-[13px]">
                      <span className="min-w-0 truncate text-text-secondary" title={entry.action}>{entry.action.replace(/[._]+/g, ' ').toLowerCase()}</span>
                      <span className="shrink-0 text-[11px] text-text-muted">{ago(entry.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            )}

            {platform.status === 'ready' && platform.data && (
              <Panel title={t('oh2.platform')} action={<span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', platform.data.operational ? 'border-success/40 text-success' : 'border-warning/40 text-warning')}><span className={cn('size-1.5 rounded-full', platform.data.operational ? 'bg-success' : 'bg-warning')} />{platform.data.operational ? t('oh2.platform.ok') : t('oh2.platform.degraded')}</span>}>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  <div><dt className="text-[10px] uppercase tracking-wide text-text-muted">{t('oh2.platform.p95')}</dt><dd className="font-display text-base font-semibold tabular-nums text-text">{platform.data.p95Ms === null ? '—' : `${number.format(Math.round(platform.data.p95Ms))} ms`}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wide text-text-muted">{t('oh2.platform.requests')}</dt><dd className="font-display text-base font-semibold tabular-nums text-text">{number.format(platform.data.requests)}</dd></div>
                  <div><dt className="text-[10px] uppercase tracking-wide text-text-muted">{t('oh2.platform.errors')}</dt><dd className="font-display text-base font-semibold tabular-nums text-text">{number.format(platform.data.errors5xx)}</dd></div>
                </dl>
                <p className="mt-2 text-center text-[11px] text-text-muted">{t('oh2.platform.window')}</p>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
