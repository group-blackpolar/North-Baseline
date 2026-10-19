import { createContext, useCallback, useContext, useState } from 'react';
import { ArrowsClockwise, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useOptionalCatalog } from '@/context/CatalogContext';
import { useOptionalOrganization } from '@/context/OrganizationContext';
import { useOptionalTabs } from '@/context/TabsContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useI18n } from '@/lib/i18n';
import { navigateToPublishedTarget } from '@/lib/publishedNavigation';
import { iconOf } from '@/features/analytics/pro/icons';
import { localizedText, TONE_VARS, toneOf } from '@/features/analytics/pro/format';
import { deriveCardState } from './cardState';
import type { ReportAccessTarget } from './reportAccessApi';
import { ReportCard } from './ReportCard';
import { useReportAccess } from './useReportAccess';

/** The Studio window runs outside the organization shell (its active organization is the personal one): it supplies the organization being edited. */
export const ReportCardsOrganizationContext = createContext<string | null>(null);

type Item = { id: string; categorySlug: string; title: unknown; description?: unknown; icon?: unknown; tone?: unknown; image?: unknown };

/**
 * `report_cards` document component: the editable list of report entries. Which ones open is decided by CORECROW per reader
 * (report-access); the document only says what to show. Needs an organization; without the workspace shell (Studio preview) the cards show their state but do not open.
 */
export function ReportCardsBlock({ props, locales }: { props: Record<string, unknown>; locales: string[] }) {
  const editing = useContext(ReportCardsOrganizationContext);
  const organization = useOptionalOrganization()?.activeOrganization;
  const organizationId = editing ?? (organization && organization.id !== PERSONAL_ORG_ID ? organization.id : null);
  if (!organizationId) return null;
  return <Inner organizationId={organizationId} organizationSlug={editing ? undefined : organization?.slug} props={props} locales={locales} />;
}

function Inner({ organizationId, organizationSlug, props, locales }: { organizationId: string; organizationSlug?: string; props: Record<string, unknown>; locales: string[] }) {
  const { t } = useI18n();
  const categories = useOptionalCatalog()?.categories;
  const navigate = useOptionalTabs()?.navigate;
  const [openError, setOpenError] = useState(false);
  const items = (Array.isArray(props.items) ? props.items : []) as Item[];
  const { access, retry } = useReportAccess(organizationId, items.map((item) => item.categorySlug));
  const open = useCallback((target: ReportAccessTarget) => {
    const category = categories?.find((entry) => entry.id === target.categoryId);
    if (!category || !navigate) { setOpenError(true); return; }
    setOpenError(false);
    void navigateToPublishedTarget({ organizationSlug, category, subcategory: category.subcategories.find((entry) => entry.id === target.subcategoryId), navigate, history: 'push', panelSlug: target.panelSlug }).catch(() => setOpenError(true));
  }, [categories, navigate, organizationSlug]);
  const title = localizedText(props.title, locales);

  return (
    <section className="@container space-y-3" aria-label={title || t('oh.reports')}>
      {title ? <h3 className="font-display text-xl font-semibold text-text">{title}</h3> : null}
      {access.status === 'error' ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-text">
          <WarningCircle size={18} aria-hidden="true" /><span className="min-w-0 flex-1">{t('oh.permError')}</span>
          <Button size="sm" variant="secondary" onClick={retry}><ArrowsClockwise className="size-3.5" />{t('oh.retry')}</Button>
        </div>
      ) : null}
      {openError ? <p role="alert" className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-text">{t('oh.openError')}</p> : null}
      <ul className="grid grid-cols-1 gap-4 @[34rem]:grid-cols-2 @[62rem]:grid-cols-3">
        {items.map((item, index) => {
          const row = access.status === 'ready' ? access.rows.get(item.categorySlug) : undefined;
          const state = deriveCardState(access, item.categorySlug);
          return (
            <li key={item.id} className="min-w-0">
              <ReportCard name={localizedText(item.title, locales)} description={localizedText(item.description, locales) || undefined} icon={iconOf(item.icon)} accent={TONE_VARS[toneOf(item.tone)].fg}
                image={typeof item.image === 'string' ? item.image : undefined} state={state} index={index} onOpen={navigate && row?.state === 'ALLOWED' && row.target ? () => open(row.target!) : undefined} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
