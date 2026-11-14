import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ChartBar, ClockCounterClockwise, Database, File, Gear, HardDrives, Plus, Sparkle, UserPlus, Users } from '@phosphor-icons/react';
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
const TONES = ['var(--color-polar)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-6)', 'var(--color-ai)'];

const firstTarget = (category: CategoryModel): ReportAccessTarget | null => {
  const subcategory = category.subcategories.find((item) => item.publishedPanels?.length);
  const panel = subcategory?.publishedPanels?.[0];
  return subcategory && panel && category.slug && subcategory.slug ? { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } : null;
};

function Panel({ title, icon: Glyph, action, children, className }: { title: string; icon?: typeof File; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('np-card min-w-0 p-4', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold text-text">
          {Glyph ? <Glyph size={16} weight="duotone" className="text-text-secondary" aria-hidden="true" /> : null}{title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Glyph, label, value, hint, tone, state }: { icon: typeof File; label: string; value: string; hint?: string; tone: string; state: Resource<unknown>['status'] | 'static' }) {
  return (
    <div className="np-card flex min-w-0 items-center gap-3 p-3.5">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}><Glyph size={22} weight="duotone" aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-text-secondary">{label}</p>
        {state === 'loading' ? <Skeleton className="mt-1 h-7 w-16" /> : <p className="font-display text-2xl font-bold leading-tight tabular-nums text-text">{value}</p>}
        {hint && state !== 'loading' ? <p className="truncate text-[11px] text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** A plain SVG area line: real request counts per bucket, no chart library on the Home. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const step = 100 / (values.length - 1);
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${(34 - (value / max) * 30).toFixed(2)}`);
  return (
    <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="h-16 w-full" aria-hidden="true">
      <defs><linearGradient id="oh-spark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-polar)" stopOpacity="0.28" /><stop offset="1" stopColor="var(--color-polar)" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,38 ${points.join(' ')} 100,38`} fill="url(#oh-spark)" />
      <polyline points={points.join(' ')} fill="none" stroke="var(--color-polar)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
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

const activityIcon = (action: string) => (/dataset|import/i.test(action) ? Database : /member|invit|user/i.test(action) ? UserPlus : /panel|revision|view|categor/i.test(action) ? File : Gear);

/**
 * Home of an organization workspace (UX-01d). A branded header, only figures CORECROW can actually give this user,
 * the reports its navigation already authorizes, recently opened panels, platform status and the way into CoreCrow AI.
 * A block the user may not see (403/404) is left out, never faked; nothing is decorative data.
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
  const platform = useResource(() => fetchPlatformStatus(), []);
  // Reads (including this very Home loading the log) are noise; show what changed.
  const changes = useMemo(() => (audit.data ?? []).filter((entry) => !/(^|[._ ])read$/i.test(entry.action)).slice(0, 4), [audit.data]);

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
    const views = category.subcategories.reduce((sum, subcategory) => sum + (subcategory.publishedPanels?.length ?? 0), 0);
    return target ? [{ key: category.id, name: category.name, views, accent: GENERIC_ACCENTS[index % GENERIC_ACCENTS.length]!, image: GENERIC_IMAGES[index % GENERIC_IMAGES.length]!, target }] : [];
  }), [categories]);

  // The structure editor lives in Administration; the shortcut only appears when the catalog offers it to this user.
  const studioTarget = useMemo(() => {
    const admin = categories.find((category) => category.slug === 'admin');
    const views = admin?.subcategories.find((subcategory) => subcategory.id === 'adm-views' || subcategory.slug === 'settings');
    return admin && views ? { admin, views } : null;
  }, [categories]);

  // Recents are resolved against the current catalog: a panel the user can no longer see is dropped.
  const visibleRecents = useMemo(() => recents.flatMap((recent) => {
    const category = categories.find((item) => item.id === recent.categoryId);
    const subcategory = category?.subcategories.find((item) => item.id === recent.subcategoryId);
    const panel = subcategory?.publishedPanels?.find((item) => item.id === recent.panelId);
    return category && subcategory && panel && category.slug && subcategory.slug
      ? [{ recent, target: { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } satisfies ReportAccessTarget }]
      : [];
  }).slice(0, 5), [recents, categories]);

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
  const openAssistant = () => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));

  return (
    <div className="@container min-h-full w-full bg-background text-text">
      <div className="mx-auto w-full max-w-[1480px] space-y-3 p-3 @[40rem]:p-4">
        {/* Branded header: navy in every theme, with the allusive port photo fading in from the right. */}
        <header className="relative isolate overflow-hidden rounded-2xl bg-navy text-white shadow-soft">
          <img src="/brand/port-hero.webp" alt="" aria-hidden="true" decoding="async" fetchPriority="low" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-y-0 right-0 -z-20 h-full w-full object-cover object-[70%_55%] opacity-80 @[48rem]:w-3/5" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-r from-navy via-navy/90 to-navy/10" />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          <div className="flex flex-col gap-4 px-5 py-5 @[48rem]:px-7 @[48rem]:py-7">
            <div className="flex items-center gap-4">
              <OrganizationAvatar name={organizationName} organizationId={activeOrganization?.id} iconAssetId={(activeOrganization as { iconAssetId?: string | null } | null)?.iconAssetId} iconData={(activeOrganization as { iconData?: string | null } | null)?.iconData} className="size-14 rounded-xl bg-white/10 text-xl text-white ring-1 ring-white/20" />
              <div className="min-w-0">
                <p className="truncate font-display text-lg font-bold leading-tight">{organizationName}</p>
                <p className="truncate text-[11px] font-medium uppercase tracking-[0.16em] text-white/70">{t('oh2.tagline')}</p>
              </div>
            </div>
            <div className="max-w-xl">
              <h1 className="font-display text-2xl font-bold leading-tight tracking-tight @[48rem]:text-4xl">{firstName ? t('oh2.title', { name: firstName }) : t('oh.title', { name: organizationName })}</h1>
              <p className="mt-1.5 text-sm leading-relaxed text-white/80">{t('oh2.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-sm"><ChartBar size={16} weight="duotone" aria-hidden="true" />{t('oh2.chip.reports', { n: number.format(entries.length) })}</span>
              {members.status === 'ready' ? <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5 ring-1 ring-white/15 backdrop-blur-sm"><Users size={16} weight="duotone" aria-hidden="true" />{t('oh2.chip.members', { n: number.format(activeMembers) })}</span> : null}
              <button type="button" onClick={openAssistant} className="inline-flex items-center gap-2 rounded-xl bg-ai px-3.5 py-1.5 font-medium text-white shadow-soft transition-opacity duration-(--duration-fast) hover:opacity-90"><Sparkle size={16} weight="fill" aria-hidden="true" />{t('oh2.ai')}</button>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 @[64rem]:grid-cols-4">
          <Kpi icon={ChartBar} tone={TONES[0]!} label={t('oh2.kpi.reports')} value={number.format(entries.length)} state={catalogLoading ? 'loading' : 'static'} />
          {shown(datasets) && <Kpi icon={Database} tone={TONES[1]!} label={t('oh2.kpi.datasets')} value={number.format(activeDatasets)} state={datasets.status} />}
          {shown(members) && <Kpi icon={Users} tone={TONES[2]!} label={t('oh2.kpi.members')} value={number.format(activeMembers)} state={members.status} />}
          {shown(storage) && <Kpi icon={HardDrives} tone={TONES[3]!} label={t('oh2.kpi.storage')} value={storage.data ? formatBytes(storage.data.usedBytes, locale) : '—'} hint={storagePercent === null ? undefined : t('oh2.kpi.storageOf', { limit: formatBytes(storage.data!.limitBytes, locale), percent: storagePercent })} state={storage.status} />}
        </div>

        <div className="grid grid-cols-1 gap-3 @[64rem]:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="min-w-0 space-y-3">
            <Panel title={t('oh.reports')} icon={ChartBar} action={<span className="hidden text-xs text-text-muted @[40rem]:inline">{t('oh.reportsHint')}</span>}>
              {openError ? <p role="alert" className="mb-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-text">{t('oh.openError')}</p> : null}
              {catalogLoading ? (
                <div className="grid gap-3 @[34rem]:grid-cols-2 @[56rem]:grid-cols-4"><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /><Skeleton className="h-44" /></div>
              ) : entries.length === 0 && !studioTarget ? (
                <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-text-secondary">{t('oh.empty')}</p>
              ) : (
                <ul className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-2 @[56rem]:grid-cols-3 @[84rem]:grid-cols-4">
                  {entries.map((entry, index) => (
                    <li key={entry.key} className="min-w-0">
                      <button type="button" onClick={() => open(entry.target)} style={{ '--i': index } as CSSProperties} className="np-card np-stagger group/card flex h-full w-full flex-col overflow-hidden text-left transition-shadow duration-(--duration-fast) hover:shadow-pop">
                        <span className="relative block h-24 w-full overflow-hidden bg-surface-active">
                          <img src={entry.image} alt="" loading="lazy" decoding="async" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.05]" />
                        </span>
                        <span className="relative flex flex-1 flex-col gap-1 p-3 pt-6">
                          <span className="absolute -top-5 left-3 grid size-9 place-items-center rounded-lg border border-border bg-surface shadow-soft" style={{ color: entry.accent }}><ChartBar size={18} weight="duotone" aria-hidden="true" /></span>
                          <span className="font-display text-[15px] font-semibold leading-tight text-text">{entry.name}</span>
                          <span className="text-xs text-text-secondary">{t('oh2.views', { n: number.format(entry.views) })}</span>
                          <ArrowRight size={16} weight="bold" aria-hidden="true" className="absolute bottom-3 right-3 text-text-muted transition-transform duration-(--duration-fast) group-hover/card:translate-x-0.5 group-hover/card:text-accent" />
                        </span>
                      </button>
                    </li>
                  ))}
                  {studioTarget ? (
                    <li className="min-w-0">
                      <button type="button" onClick={() => open({ categoryId: studioTarget.admin.id, categorySlug: studioTarget.admin.slug ?? 'admin', subcategoryId: studioTarget.views.id, subcategorySlug: studioTarget.views.slug ?? '', panelSlug: '' })} className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong p-3 text-center transition-colors duration-(--duration-fast) hover:border-accent hover:bg-accent-soft">
                        <Plus size={22} weight="bold" className="text-polar" aria-hidden="true" />
                        <span className="font-display text-[15px] font-semibold text-polar">{t('oh2.createView')}</span>
                        <span className="text-xs text-text-secondary">{t('oh2.createViewBody')}</span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              )}
            </Panel>

            <div className="grid gap-3 @[48rem]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
              <section className="relative isolate overflow-hidden rounded-xl bg-gradient-to-br from-navy via-[#232C5E] to-ai p-4 text-white shadow-soft">
                <div aria-hidden="true" className="absolute -right-8 -top-8 -z-10 size-40 rounded-full bg-white/10 blur-2xl" />
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Sparkle size={20} weight="fill" aria-hidden="true" />CoreCrow AI</h2>
                <p className="mt-1 text-sm text-white/80">{t('oh2.aiBody', { name: organizationName })}</p>
                <button type="button" onClick={openAssistant} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-1.5 text-sm font-semibold text-navy transition-opacity duration-(--duration-fast) hover:opacity-90">{t('oh2.aiOpen')}<ArrowRight size={14} weight="bold" aria-hidden="true" /></button>
              </section>
              {storage.status === 'ready' && storage.data ? (
                <Panel title={t('oh2.usage')} icon={HardDrives}>
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between text-xs"><span className="text-text-secondary">{t('oh2.kpi.storage')}</span><span className="tabular-nums text-text-muted">{formatBytes(storage.data.usedBytes, locale)} / {formatBytes(storage.data.limitBytes, locale)}{storagePercent === null ? '' : ` · ${storagePercent} %`}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-active" role="progressbar" aria-valuenow={storagePercent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={t('oh2.kpi.storage')}><div className="h-full rounded-full bg-polar" style={{ width: `${Math.max(storagePercent ?? 0, storagePercent ? 1 : 0)}%` }} /></div>
                  </div>
                </Panel>
              ) : null}
            </div>
          </div>

          <aside className="min-w-0 space-y-3">
            {platform.status === 'ready' && platform.data && platform.data.series.length > 1 ? (
              <Panel title={t('oh2.traffic')} icon={ChartBar} action={<span className="text-[11px] text-text-muted">{t('oh2.platform.window')}</span>}>
                <Sparkline values={platform.data.series} />
                <div className="mt-1 flex justify-between text-[11px] text-text-muted"><span>{t('oh2.platform.requests')}: <span className="tabular-nums text-text-secondary">{number.format(platform.data.requests)}</span></span><span>p95: <span className="tabular-nums text-text-secondary">{platform.data.p95Ms === null ? '—' : `${number.format(Math.round(platform.data.p95Ms))} ms`}</span></span></div>
              </Panel>
            ) : null}

            <Panel title={t('oh2.recents')} icon={ClockCounterClockwise}>
              {visibleRecents.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('oh2.recentsEmpty')}</p>
              ) : (
                <ul className="-mx-1 space-y-0.5">
                  {visibleRecents.map(({ recent, target }) => (
                    <li key={recent.panelId}>
                      <button type="button" onClick={() => open(target)} className="np-press-flat flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-active text-text-secondary"><File size={15} weight="duotone" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">{recent.title}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(recent.openedAt)}</span>
                        <ArrowUpRight size={12} className="shrink-0 text-text-muted" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {audit.status === 'ready' && changes.length > 0 && (
              <Panel title={t('oh2.activity')} icon={Gear}>
                <ul className="space-y-2">
                  {changes.map((entry) => {
                    const Glyph = activityIcon(entry.action);
                    return (
                      <li key={entry.id} className="flex items-center gap-2.5 text-[13px]">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent"><Glyph size={14} weight="duotone" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-text" title={entry.action}>{entry.action.replace(/[._]+/g, ' ').toLowerCase()}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(entry.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Panel>
            )}

            {platform.status === 'ready' && platform.data && (
              <Panel title={t('oh2.platform')} icon={HardDrives} action={<span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', platform.data.operational ? 'border-success/40 text-success' : 'border-warning/40 text-warning')}><span className={cn('size-1.5 rounded-full', platform.data.operational ? 'bg-success' : 'bg-warning')} />{platform.data.operational ? t('oh2.platform.ok') : t('oh2.platform.degraded')}</span>}>
                <ul className="space-y-1.5">
                  {platform.data.modules.map((module) => (
                    <li key={module.name} className="flex items-center gap-2 text-[13px]"><span className={cn('size-2 rounded-full', module.available ? 'bg-success' : 'bg-warning')} aria-hidden="true" /><span className="flex-1 truncate text-text">{module.name}</span><span className="text-[11px] text-text-muted">{module.available ? t('oh2.platform.ok') : t('oh2.platform.degraded')}</span></li>
                  ))}
                </ul>
              </Panel>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
