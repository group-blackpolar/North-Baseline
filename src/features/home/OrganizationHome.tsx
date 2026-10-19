import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowsClockwise, Package, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { OrganizationAvatar } from '@/components/organization/OrganizationAvatar';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { useI18n } from '@/lib/i18n';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import type { SessionUser } from '@/lib/auth';
import type { CategoryModel } from '@/lib/models';
import { CURATED_REPORTS, GENERIC_ACCENTS, GENERIC_CROPS, type ReportDefinition } from './homeReports';
import { getReportAccess, type ReportAccessTarget } from './reportAccessApi';
import { ReportCard } from './ReportCard';
import { deriveCardState, type AccessLookup, type CardState } from './cardState';

type Access = AccessLookup;
const SYSTEM_CATEGORIES = new Set(['home', 'admin']);

/** Reports of a curated organization: one authorized request answers every card. */
function useReportAccess(organizationId: string | undefined, slugs: string[]) {
  const [access, setAccess] = useState<Access>({ status: 'loading' });
  const key = slugs.join(',');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!organizationId || !key) return;
    const controller = new AbortController();
    setAccess({ status: 'loading' });
    getReportAccess(organizationId, key.split(','), controller.signal)
      .then((rows) => setAccess({ status: 'ready', rows: new Map(rows.map((row) => [row.slug, row])) }))
      // A failed lookup says nothing about access: never fall back to "allowed".
      .catch(() => { if (!controller.signal.aborted) setAccess({ status: 'error' }); });
    return () => controller.abort();
  }, [organizationId, key, attempt]);
  return { access, retry: () => setAttempt((value) => value + 1) };
}

const firstTarget = (category: CategoryModel): ReportAccessTarget | null => {
  const subcategory = category.subcategories.find((item) => item.publishedPanels?.length);
  const panel = subcategory?.publishedPanels?.[0];
  return subcategory && panel && category.slug && subcategory.slug ? { categoryId: category.id, categorySlug: category.slug, subcategoryId: subcategory.id, subcategorySlug: subcategory.slug, panelSlug: panel.slug } : null;
};

/**
 * Home of an organization workspace. SHARK has a curated Home with its seven reports (access summarized by CORECROW);
 * any other organization gets the same layout built from the categories its navigation already authorizes.
 */
export function OrganizationHome({ user }: { user: SessionUser }) {
  const { t, locale } = useI18n();
  const { activeOrganization } = useOrganization();
  const { categories, isLoading: catalogLoading } = useCatalog();
  const { navigate } = useTabs();
  const [openError, setOpenError] = useState(false);
  const curated = activeOrganization?.slug ? CURATED_REPORTS[activeOrganization.slug] : undefined;
  const { access, retry } = useReportAccess(activeOrganization?.id, curated?.reports.map((report) => report.slug) ?? []);

  const open = useCallback((target: ReportAccessTarget) => {
    const category = categories.find((item) => item.id === target.categoryId);
    if (!category) { setOpenError(true); return; }
    setOpenError(false);
    void navigateToPublishedTarget({ organizationSlug: activeOrganization?.slug, category, subcategory: category.subcategories.find((item) => item.id === target.subcategoryId), navigate, history: 'push', panelSlug: target.panelSlug }).catch(() => setOpenError(true));
  }, [activeOrganization?.slug, categories, navigate]);

  type Entry = { key: string; name: string; description?: string; icon: ReportDefinition['icon']; accent: string; crop: ReportDefinition['crop']; state: CardState; target: ReportAccessTarget | null };
  const entries = useMemo<Entry[]>(() => {
    if (curated) {
      return curated.reports.map((report): Entry => {
        const row = access.status === 'ready' ? access.rows.get(report.slug) : undefined;
        const state = deriveCardState(access, report.slug);
        return { key: report.slug, name: t(report.nameKey), description: t(report.descriptionKey), icon: report.icon, accent: report.accent, crop: report.crop, state, target: row?.state === 'ALLOWED' ? row.target : null };
      });
    }
    return categories.filter((category) => category.slug && !SYSTEM_CATEGORIES.has(category.slug)).flatMap((category, index): Entry[] => {
      const target = firstTarget(category);
      return target ? [{ key: category.id, name: category.name, icon: Package, accent: GENERIC_ACCENTS[index % GENERIC_ACCENTS.length]!, crop: GENERIC_CROPS[index % GENERIC_CROPS.length]!, state: 'allowed', target }] : [];
    });
  }, [access, categories, curated, t]);

  const allowed = entries.filter((entry) => entry.state === 'allowed').length;
  const organizationName = activeOrganization?.name ?? '';
  const productName = curated?.productName ?? organizationName;
  const firstName = user.name?.trim().split(/\s+/)[0];
  const loading = curated ? access.status === 'loading' : catalogLoading;
  const subtitle = new Intl.NumberFormat(locale);

  return (
    <div className="oh-root @container min-h-full w-full">
      <div className="mx-auto w-full max-w-[1280px] space-y-8 p-4 @[40rem]:p-6 @[64rem]:p-8">
        <header className="relative isolate overflow-hidden rounded-3xl border border-white/10 bg-[#0B1D30]">
          <img src="/brand/shark-port-hero.webp" alt="" aria-hidden="true" decoding="async" fetchPriority="low" onError={(event) => { event.currentTarget.style.display = 'none'; }}
            className="absolute inset-0 -z-20 size-full object-cover object-[70%_55%] opacity-50" />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(100deg,#061321_8%,rgba(6,19,33,0.86)_46%,rgba(11,29,48,0.4)_100%)]" />
          <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-[#061321] to-transparent" />
          <div className="flex flex-col gap-6 p-6 @[48rem]:flex-row @[48rem]:items-center @[48rem]:justify-between @[48rem]:p-10">
            <div className="max-w-2xl space-y-4">
              <div className="flex items-center gap-3">
                {curated ? (
                  <span className="grid h-14 w-12 shrink-0 place-items-center rounded-xl bg-white p-1.5 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)]">
                    <img src="/brand/shark-logo.png" alt={`${productName} logo`} className="size-full object-contain" />
                  </span>
                ) : (
                  <OrganizationAvatar name={organizationName} organizationId={activeOrganization?.id} iconAssetId={(activeOrganization as { iconAssetId?: string | null } | null)?.iconAssetId} iconData={(activeOrganization as { iconData?: string | null } | null)?.iconData} className="size-14" />
                )}
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#7DD3FC]">{t('oh.eyebrow')}</p>
                  {firstName ? <p className="text-sm text-slate-300">{t('oh.greeting', { name: firstName })}</p> : null}
                </div>
              </div>
              <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-white @[48rem]:text-4xl">{t('oh.title', { name: productName })}</h1>
              <p className="max-w-xl text-base leading-relaxed text-slate-300">{t('oh.tagline')}</p>
            </div>
            <dl className="flex shrink-0 flex-wrap gap-3 text-sm @[48rem]:flex-col @[48rem]:items-stretch">
              <div className="rounded-xl border border-white/10 bg-[#061321]/70 px-4 py-2.5"><dt className="text-[11px] uppercase tracking-wide text-slate-400">{t('oh.org')}</dt><dd className="font-medium text-white">{organizationName}</dd></div>
              {!loading && entries.length > 0 && (!curated || access.status === 'ready') ? <div className="rounded-xl border border-white/10 bg-[#061321]/70 px-4 py-2.5"><dt className="text-[11px] uppercase tracking-wide text-slate-400">{t('oh.available')}</dt><dd className="font-medium text-white tabular-nums">{t('oh.availableValue', { allowed: subtitle.format(allowed), total: subtitle.format(entries.length) })}</dd></div> : null}
            </dl>
          </div>
        </header>

        <section aria-labelledby="oh-reports" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="oh-reports" className="font-display text-2xl font-semibold text-white">{t('oh.reports')}</h2>
              <p className="mt-1 text-sm text-slate-400">{t('oh.reportsHint')}</p>
            </div>
          </div>
          {curated && access.status === 'error' ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
              <WarningCircle size={18} aria-hidden="true" /><span className="min-w-0 flex-1">{t('oh.permError')}</span>
              <Button size="sm" variant="secondary" onClick={retry}><ArrowsClockwise className="size-3.5" />{t('oh.retry')}</Button>
            </div>
          ) : null}
          {openError ? <p role="alert" className="rounded-xl border border-rose-300/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">{t('oh.openError')}</p> : null}
          {entries.length === 0 && !loading ? (
            <p className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center text-sm text-slate-300">{t('oh.empty')}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-4 @[34rem]:grid-cols-2 @[62rem]:grid-cols-3">
              {(entries.length ? entries : Array.from({ length: 6 }, (_, index): Entry => ({ key: String(index), name: '…', icon: Package, accent: GENERIC_ACCENTS[index]!, crop: GENERIC_CROPS[index]!, state: 'loading', target: null }))).map((entry, index) => (
                <li key={entry.key} className="min-w-0">
                  <ReportCard name={entry.name} description={entry.description} icon={entry.icon} accent={entry.accent} crop={entry.crop} state={entry.state} index={index} onOpen={entry.target ? () => open(entry.target!) : undefined} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
