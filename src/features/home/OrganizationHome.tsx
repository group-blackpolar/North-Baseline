import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowRight, ArrowUpRight, ChartBar, ClockCounterClockwise, Database, File, Gear, HardDrives, Pulse, Plus, Sparkle, TrendUp, UserPlus, Users } from '@phosphor-icons/react';
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
import { dailyCounts } from './activitySeries';
import { fetchPlatformStatus } from './platformStatus';
import { RECENTS_EVENT, readRecents, type Recent } from './recents';
import type { ReportAccessTarget } from './reportAccessApi';

const SYSTEM_CATEGORIES = new Set(['home', 'admin']);
const TONES = ['var(--color-polar)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-6)', 'var(--color-ai)'];
const DAYS = 30;

const firstTarget = (category: CategoryModel): ReportAccessTarget | null => {
  const subcategory = category.subcategories.find((item) => item.publishedPanels?.length);
  const panel = subcategory?.publishedPanels?.[0];
  return subcategory && panel && category.slug && subcategory.slug ? { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } : null;
};

function Panel({ title, icon: Glyph, action, children, className }: { title: string; icon?: typeof File; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('oh-card flex min-w-0 flex-col p-4', className)}>
      <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-[15px] font-bold text-text">
          {Glyph ? <Glyph size={17} weight="duotone" className="text-polar" aria-hidden="true" /> : null}{title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ icon: Glyph, label, value, hint, tone, state }: { icon: typeof File; label: string; value: string; hint?: string; tone: string; state: Resource<unknown>['status'] | 'static' }) {
  return (
    <div className="oh-card flex min-w-0 items-center gap-3 p-3.5">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl shadow-soft" style={{ background: `linear-gradient(145deg, color-mix(in srgb, ${tone} 8%, var(--color-surface)), color-mix(in srgb, ${tone} 24%, var(--color-surface)))`, color: tone, boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.5), 0 6px 12px -6px color-mix(in srgb, ${tone} 55%, transparent)` }}><Glyph size={24} weight="duotone" aria-hidden="true" /></span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold text-text-secondary">{label}</p>
        {state === 'loading' ? <Skeleton className="mt-1 h-8 w-16" /> : <p className="font-display text-[28px] font-extrabold tabular-nums text-text">{value}</p>}
        {hint && state !== 'loading' ? <p className="truncate text-[11px] text-text-muted">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Area chart with a hover read-out. Plain SVG: the Home carries no chart library. Values are real counts per day. */
function ActivityChart({ days, values, label, locale }: { days: Date[]; values: number[]; label: (value: number, day: Date) => string; locale: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 340; const height = 150; const left = 30; const bottom = 128; const top = 14;
  const max = Math.max(...values, 1);
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const x = (index: number) => left + (index * (width - left - 8)) / Math.max(values.length - 1, 1);
  const y = (value: number) => bottom - (value / nice) * (bottom - top);
  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(values.length - 1).toFixed(1)},${bottom} L${x(0).toFixed(1)},${bottom} Z`;
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' });
  const ticks = [0, Math.round((days.length - 1) / 4), Math.round((days.length - 1) / 2), Math.round(((days.length - 1) * 3) / 4), days.length - 1];
  const active = hover ?? values.length - 1;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label(values[active] ?? 0, days[active] ?? new Date())}
        onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const ratio = (event.clientX - rect.left) / rect.width; setHover(Math.max(0, Math.min(values.length - 1, Math.round(((ratio * width - left) / (width - left - 8)) * (values.length - 1))))); }}
        onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="oh-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--color-polar)" stopOpacity="0.34" /><stop offset="1" stopColor="var(--color-polar)" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3, 4].map((step) => <g key={step}><line x1={left} x2={width - 4} y1={y((nice * step) / 4)} y2={y((nice * step) / 4)} stroke="var(--color-border)" strokeWidth="1" /><text x={2} y={y((nice * step) / 4) + 3} fontSize="9" fontWeight="600" fill="var(--color-text-muted)">{Math.round((nice * step) / 4)}</text></g>)}
        {ticks.map((index) => <text key={index} x={x(index)} y={height - 4} fontSize="9" fontWeight="600" textAnchor={index === 0 ? 'start' : index === days.length - 1 ? 'end' : 'middle'} fill="var(--color-text-muted)">{format.format(days[index]!)}</text>)}
        <path d={area} fill="url(#oh-area)" />
        <path d={line} fill="none" stroke="var(--color-polar)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
        <line x1={x(active)} x2={x(active)} y1={y(values[active] ?? 0)} y2={bottom} stroke="var(--color-polar)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        <circle cx={x(active)} cy={y(values[active] ?? 0)} r="4.5" fill="var(--color-surface)" stroke="var(--color-polar)" strokeWidth="2.2" />
      </svg>
      <div className="pointer-events-none absolute top-0 w-max whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-1.5 text-[11px] leading-snug shadow-pop" style={{ left: `${Math.min(Math.max((x(active) / width) * 100, 18), 78)}%`, transform: 'translateX(-50%)' }}>
        <div className="text-text-secondary">{format.format(days[active] ?? new Date())}</div>
        <div className="font-display text-[13px] font-extrabold text-text">{label(values[active] ?? 0, days[active] ?? new Date())}</div>
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

const activityIcon = (action: string) => (/dataset|import/i.test(action) ? Database : /member|invit|user/i.test(action) ? UserPlus : /panel|revision|view|categor/i.test(action) ? File : Gear);

/**
 * Home of an organization workspace (UX-01d), as designed in Claude Design. A branded header, figures CORECROW can actually
 * give this user, the reports its navigation already authorizes, activity, recently opened panels, service status and
 * the way into CoreCrow AI. A block the user may not see (403/404) is left out or replaced by an honest empty state, never faked.
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
  const audit = useResource(() => listAuditEntries(organizationId, { limit: 100 }), [organizationId]);
  const platform = useResource(() => fetchPlatformStatus(), []);
  // Reads (including this very Home loading the log) are noise; show what changed.
  const changes = useMemo(() => (audit.data ?? []).filter((entry) => !/(^|[._ ])read$/i.test(entry.action)), [audit.data]);
  // The chart counts organization events per day when the user may read the audit log; otherwise it shows platform traffic.
  const series = useMemo(() => {
    if (audit.status === 'ready') return { kind: 'audit' as const, ...dailyCounts(changes.map((entry) => entry.createdAt), DAYS) };
    if (platform.status === 'ready' && platform.data && platform.data.series.length > 1) {
      const end = new Date(); const step = (24 * 3600 * 1000) / platform.data.series.length;
      return { kind: 'platform' as const, days: platform.data.series.map((_, index) => new Date(end.getTime() - (platform.data!.series.length - 1 - index) * step)), values: platform.data.series };
    }
    return null;
  }, [audit.status, changes, platform.data, platform.status]);

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

  // The structure editor and the audit log live in Administration; shortcuts only appear when the catalog offers them to this user.
  const admin = useMemo(() => categories.find((category) => category.slug === 'admin'), [categories]);
  const studioTarget = useMemo(() => {
    const views = admin?.subcategories.find((subcategory) => subcategory.id === 'adm-views' || subcategory.slug === 'settings');
    return admin && views ? { admin, views } : null;
  }, [admin]);
  const auditSub = admin?.subcategories.find((subcategory) => subcategory.id === 'adm-audit');

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
  const operational = platform.data?.operational ?? false;
  const statusPill = (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold', operational ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning')}>
      <span className={cn('size-1.5 rounded-full', operational ? 'bg-success shadow-[0_0_0_3px_rgb(18_183_106/0.2)]' : 'bg-warning')} />{operational ? t('oh2.platform.ok') : t('oh2.platform.degraded')}
    </span>
  );
  const viewAudit = auditSub && admin ? (
    <button type="button" onClick={() => navigate(admin.id, auditSub.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-text transition-colors duration-(--duration-fast) hover:text-polar">{t('oh2.viewAll')}<ArrowRight size={13} weight="bold" aria-hidden="true" /></button>
  ) : null;

  return (
    <div className="@container oh-bg h-full w-full overflow-y-auto text-text">
      <div className="mx-auto flex min-h-full w-full max-w-[1560px] flex-col gap-3 p-3 @[40rem]:p-4">
        {/* Branded header: navy in every theme; the allusive photo spans the whole header and the gradients tie it to the text. */}
        <header className="relative isolate shrink-0 overflow-hidden rounded-2xl bg-navy text-white shadow-[0_2px_4px_rgb(10_20_40/0.25),0_22px_44px_-14px_rgb(21_34_59/0.65)] ring-1 ring-white/5">
          <img src="/brand/port-hero.webp" alt="" aria-hidden="true" decoding="async" fetchPriority="low" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 -z-30 size-full object-cover object-[72%_52%]" />
          <div aria-hidden="true" className="absolute inset-0 -z-20 bg-gradient-to-r from-navy from-20% via-navy/90 via-40% to-navy/5" />
          <div aria-hidden="true" className="absolute inset-0 -z-20 bg-[radial-gradient(600px_300px_at_12%_105%,rgb(52_107_235/0.45),transparent_70%),radial-gradient(420px_240px_at_92%_0%,rgb(255_170_90/0.18),transparent_70%)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-20 bg-gradient-to-t from-[#0E1A31]/65 to-transparent" />
          <div aria-hidden="true" className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          <div className="flex flex-col gap-4 px-5 py-6 @[48rem]:px-9 @[48rem]:py-8">
            <div className="flex items-center gap-4">
              <OrganizationAvatar name={organizationName} organizationId={activeOrganization?.id} iconAssetId={(activeOrganization as { iconAssetId?: string | null } | null)?.iconAssetId} iconData={(activeOrganization as { iconData?: string | null } | null)?.iconData} className="size-16 rounded-2xl bg-white/15 text-2xl text-white shadow-[inset_0_0_0_1px_rgb(255_255_255/0.28),0_10px_24px_-8px_rgb(0_0_0/0.6)]" />
              <div className="min-w-0 leading-tight">
                <p className="truncate font-display text-xl font-extrabold">{organizationName}</p>
                <p className="truncate text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">{t('oh2.tagline')}</p>
              </div>
            </div>
            <div className="max-w-xl">
              <h1 className="font-display text-4xl font-extrabold leading-none tracking-tight drop-shadow-[0_2px_16px_rgb(0_0_0/0.35)] @[48rem]:text-5xl">{firstName ? t('oh2.welcome', { name: firstName }) : t('oh.title', { name: organizationName })}</h1>
              <p className="mt-2.5 text-sm leading-relaxed text-white/80">{t('oh2.subtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-2.5 text-sm">
              <span className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-white/20 to-white/5 px-3.5 py-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22),0_8px_18px_-8px_rgb(0_0_0/0.5)] backdrop-blur-sm"><ChartBar size={18} weight="duotone" aria-hidden="true" />{t('oh2.chip.reports', { n: number.format(entries.length) })}</span>
              {members.status === 'ready' ? <span className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-b from-white/20 to-white/5 px-3.5 py-2 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.22),0_8px_18px_-8px_rgb(0_0_0/0.5)] backdrop-blur-sm"><Users size={18} weight="duotone" aria-hidden="true" />{t('oh2.chip.members', { n: number.format(activeMembers) })}</span> : null}
            </div>
          </div>
        </header>

        <div className="grid shrink-0 grid-cols-2 gap-3 @[64rem]:grid-cols-4">
          <Kpi icon={ChartBar} tone={TONES[0]!} label={t('oh2.kpi.reports')} value={number.format(entries.length)} state={catalogLoading ? 'loading' : 'static'} />
          {shown(datasets) && <Kpi icon={Database} tone={TONES[1]!} label={t('oh2.kpi.datasets')} value={number.format(activeDatasets)} state={datasets.status} />}
          {shown(members) && <Kpi icon={Users} tone={TONES[2]!} label={t('oh2.kpi.members')} value={number.format(activeMembers)} state={members.status} />}
          {shown(storage) && <Kpi icon={HardDrives} tone={TONES[3]!} label={t('oh2.kpi.storage')} value={storage.data ? formatBytes(storage.data.usedBytes, locale) : '—'} hint={storagePercent === null ? undefined : t('oh2.kpi.storageOf', { limit: formatBytes(storage.data!.limitBytes, locale), percent: storagePercent })} state={storage.status} />}
        </div>

        <div className="grid grid-cols-1 items-start gap-3 @[60rem]:grid-cols-[minmax(0,1fr)_22rem]">
          <Panel title={t('oh.reports')} icon={ChartBar} action={<span className="hidden text-xs text-text-muted @[40rem]:inline">{t('oh.reportsHint')}</span>}>
            {openError ? <p role="alert" className="mb-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-text">{t('oh.openError')}</p> : null}
            {catalogLoading ? (
              <div className="grid gap-3 @[34rem]:grid-cols-2 @[56rem]:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>
            ) : entries.length === 0 && !studioTarget ? (
              <p className="rounded-lg border border-dashed border-border-strong px-4 py-8 text-center text-sm text-text-secondary">{t('oh.empty')}</p>
            ) : (
              <ul className="grid grid-cols-1 content-start gap-x-3 gap-y-5 pt-6 @[30rem]:grid-cols-2 @[56rem]:grid-cols-3 @[84rem]:grid-cols-4">
                {entries.map((entry, index) => (
                  <li key={entry.key} className="min-w-0">
                    <button type="button" onClick={() => open(entry.target)} style={{ '--i': index } as CSSProperties} className="np-stagger group/card relative flex h-full w-full flex-col overflow-hidden rounded-[14px] bg-surface text-left shadow-[0_0_0_1px_var(--color-border),0_2px_4px_rgb(16_32_66/0.06),0_14px_24px_-14px_rgb(30_58_138/0.4)] transition-[box-shadow,transform] duration-(--duration-fast) hover:-translate-y-0.5 hover:shadow-pop">
                      <span className="relative block h-20 w-full overflow-hidden bg-surface-active">
                        <img src={entry.image} alt="" loading="lazy" decoding="async" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = 'none'; }} className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover/card:scale-[1.05]" />
                        <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0F1B33]/35" />
                      </span>
                      <span className="relative flex flex-1 flex-col gap-0.5 bg-gradient-to-b from-surface to-surface-hover/60 px-3.5 pb-3.5 pt-6">
                        <span className="absolute -top-5 left-3 grid size-10 place-items-center rounded-xl bg-gradient-to-b from-surface to-surface-hover shadow-[0_0_0_1px_var(--color-border),0_8px_14px_-6px_rgb(30_58_138/0.5)]" style={{ color: entry.accent }}><ChartBar size={20} weight="duotone" aria-hidden="true" /></span>
                        <span className="mt-1 font-display text-[15px] font-extrabold leading-tight text-text">{entry.name}</span>
                        <span className="text-xs text-text-secondary">{t('oh2.views', { n: number.format(entry.views) })}</span>
                        <span className="absolute bottom-3 right-3 grid size-7 place-items-center rounded-full bg-accent-soft text-polar transition-transform duration-(--duration-fast) group-hover/card:translate-x-0.5"><ArrowRight size={13} weight="bold" aria-hidden="true" /></span>
                      </span>
                    </button>
                  </li>
                ))}
                {studioTarget ? (
                  <li className="min-w-0">
                    <button type="button" onClick={() => open({ categoryId: studioTarget.admin.id, categorySlug: studioTarget.admin.slug ?? 'admin', subcategoryId: studioTarget.views.id, subcategorySlug: studioTarget.views.slug ?? '', panelSlug: '' })} className="flex h-full min-h-36 w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border-[1.5px] border-dashed border-polar/40 bg-gradient-to-b from-accent-soft to-transparent p-3 text-center transition-colors duration-(--duration-fast) hover:border-polar">
                      <span className="grid size-9 place-items-center rounded-full bg-surface text-polar shadow-[0_6px_12px_-6px_rgb(52_107_235/0.6),0_0_0_1px_var(--color-border)]"><Plus size={18} weight="bold" aria-hidden="true" /></span>
                      <span className="font-display text-[15px] font-extrabold text-polar">{t('oh2.createView')}</span>
                      <span className="text-xs leading-snug text-text-secondary">{t('oh2.createViewBody')}</span>
                    </button>
                  </li>
                ) : null}
              </ul>
            )}
          </Panel>

          <aside className="flex min-w-0 flex-col gap-3">
            <Panel title={series?.kind === 'platform' ? t('oh2.traffic') : t('oh2.chart')} icon={TrendUp} action={<span className="text-[11px] text-text-muted">{series?.kind === 'platform' ? t('oh2.platform.window') : t('oh2.chart.window', { n: DAYS })}</span>}>
              {series ? (
                <ActivityChart days={series.days} values={series.values} locale={locale} label={(value) => t(series.kind === 'platform' ? 'oh2.chart.requests' : 'oh2.chart.events', { n: number.format(value) })} />
              ) : audit.status === 'loading' || platform.status === 'loading' ? <Skeleton className="h-36 w-full" /> : <p className="text-sm text-text-secondary">{t('oh2.chart.empty')}</p>}
            </Panel>

            <Panel title={t('oh2.recents')} icon={ClockCounterClockwise}>
              {visibleRecents.length === 0 ? (
                <p className="text-sm text-text-secondary">{t('oh2.recentsEmpty')}</p>
              ) : (
                <ul className="-mx-1 space-y-0.5">
                  {visibleRecents.map(({ recent, target }) => (
                    <li key={recent.panelId}>
                      <button type="button" onClick={() => open(target)} className="np-press-flat flex w-full items-center gap-2.5 rounded-md px-1 py-1.5 text-left transition-colors duration-(--duration-fast) hover:bg-surface-hover">
                        <span className="grid size-7 shrink-0 place-items-center rounded-md bg-surface-active text-text-secondary"><File size={15} weight="duotone" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">{recent.title}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(recent.openedAt)}</span>
                        <ArrowUpRight size={12} className="shrink-0 text-text-muted" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title={t('oh2.activity')} icon={Pulse} action={viewAudit}>
              {audit.status === 'loading' ? <Skeleton className="h-24 w-full" /> : changes.length === 0 ? (
                <p className="text-sm text-text-secondary">{audit.status === 'ready' ? t('oh2.activityEmpty') : t('oh2.activityRestricted')}</p>
              ) : (
                <ul className="space-y-2.5">
                  {changes.slice(0, 4).map((entry) => {
                    const Glyph = activityIcon(entry.action);
                    return (
                      <li key={entry.id} className="flex items-center gap-3 text-[13px]">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-polar"><Glyph size={15} weight="duotone" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-text" title={entry.action}>{entry.action.replace(/[._]+/g, ' ').toLowerCase()}</span>
                        <span className="shrink-0 text-[11px] text-text-muted">{ago(entry.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel title={t('oh2.platform')} icon={Pulse} action={platform.status === 'ready' ? statusPill : undefined}>
              {platform.status === 'loading' ? <Skeleton className="h-28 w-full" /> : platform.status === 'ready' && platform.data ? (
                <>
                  <ul className="divide-y divide-border/70 text-[13px]">
                    {platform.data.modules.map((module) => (
                      <li key={module.name} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0"><span className={cn('size-2.5 rounded-full', module.available ? 'bg-success shadow-[0_0_0_3px_rgb(18_183_106/0.18)]' : 'bg-warning')} aria-hidden="true" /><span className="flex-1 truncate font-semibold text-text">{module.name}</span><span className="text-[11px] text-text-muted">{module.available ? t('oh2.platform.ok') : t('oh2.platform.degraded')}</span></li>
                    ))}
                  </ul>
                  <p className="mt-2.5 border-t border-border/70 pt-2 text-center text-[11px] text-text-muted">{t('oh2.platform.p95')}: <span className="tabular-nums text-text-secondary">{platform.data.p95Ms === null ? '—' : `${number.format(Math.round(platform.data.p95Ms))} ms`}</span> · {t('oh2.platform.requests')}: <span className="tabular-nums text-text-secondary">{number.format(platform.data.requests)}</span> · {t('oh2.platform.window')}</p>
                </>
              ) : <p className="text-sm text-text-secondary">{t('oh2.platformUnavailable')}</p>}
            </Panel>
          </aside>
        </div>

        <div className="grid shrink-0 gap-3 @[48rem]:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
          <section className="relative isolate flex items-center gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-navy via-[#22357A] to-ai px-5 py-4 text-white shadow-[0_2px_4px_rgb(10_20_40/0.25),0_20px_40px_-16px_rgb(54_60_160/0.7),inset_0_1px_0_rgb(255_255_255/0.18)]">
            <div aria-hidden="true" className="absolute -right-8 -top-12 -z-10 size-48 rounded-full bg-ai/50 blur-3xl" />
            <svg aria-hidden="true" viewBox="0 0 600 120" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 -z-10 h-16 w-full opacity-50"><path d="M0 90C80 40 150 120 250 70S420 20 600 80" fill="none" stroke="#9DB8FF" strokeOpacity=".5" strokeWidth="1.4" /></svg>
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-white/20 to-white/5 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.25),0_10px_20px_-8px_rgb(0_0_0/0.5)]"><Sparkle size={28} weight="fill" aria-hidden="true" /></span>
            <div className="min-w-0 flex-1 leading-tight"><h2 className="font-display text-xl font-extrabold">CoreCrow AI</h2><p className="mt-1 text-[13px] text-white/80">{t('oh2.aiBody', { name: organizationName })}</p></div>
            <button type="button" onClick={openAssistant} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-gradient-to-b from-white to-[#E9EFFF] px-4 py-2.5 text-[13px] font-extrabold text-navy shadow-[0_10px_20px_-8px_rgb(0_0_0/0.55)] transition-opacity duration-(--duration-fast) hover:opacity-90">{t('oh2.aiOpen')}<ArrowRight size={14} weight="bold" aria-hidden="true" /></button>
          </section>
          <Panel title={t('oh2.usage')} icon={Database}>
            {storage.status === 'ready' && storage.data ? (
              <div className="space-y-1.5">
                <div className="flex items-baseline justify-between text-xs"><span className="font-semibold text-text">{t('oh2.kpi.storage')}</span><span className="tabular-nums text-text-secondary"><b className="text-text">{formatBytes(storage.data.usedBytes, locale)}</b> / {formatBytes(storage.data.limitBytes, locale)}{storagePercent === null ? '' : ` · ${storagePercent} %`}</span></div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-active shadow-[inset_0_1px_2px_rgb(16_32_66/0.12)]" role="progressbar" aria-valuenow={storagePercent ?? 0} aria-valuemin={0} aria-valuemax={100} aria-label={t('oh2.kpi.storage')}><div className="h-full rounded-full bg-gradient-to-r from-polar to-[#5E93FF] shadow-[0_4px_10px_-3px_rgb(52_107_235/0.7)]" style={{ width: `${Math.max(storagePercent ?? 0, storagePercent ? 1 : 0)}%` }} /></div>
              </div>
            ) : storage.status === 'loading' ? <Skeleton className="h-8 w-full" /> : <p className="text-sm text-text-secondary">{t('oh2.usageRestricted')}</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
