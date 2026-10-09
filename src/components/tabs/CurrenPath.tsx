import { CaretRight } from '@phosphor-icons/react';
import { useTabs } from '@/context/TabsContext';
import { useCatalog } from '@/context/CatalogContext';
import { useI18n } from '@/lib/i18n';
import { useOrganization } from '@/context/OrganizationContext';
import { OrganizationIcon } from '@/components/organization/OrganizationAvatar';
import { identityOf, isBrandHex } from '@/lib/brand';

export function CurrentPath() {
  const { t } = useI18n();
  const { activeTab } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();
  const { activeOrganization } = useOrganization();

  if (!activeTab) return null;
  const identity = identityOf(activeOrganization);
  const branded = Boolean(activeOrganization && (identity.iconData || identity.iconAssetId || isBrandHex(identity.brandAccent)));

  const category = getCategory(activeTab.route.categoryId);
  const subcategory = getSubcategory(activeTab.route.categoryId, activeTab.route.subcategoryId);

  return (
    <div className="relative shrink-0 flex items-center gap-1 px-3 border-b border-border/60 bg-surface-hover/30 text-xs text-text-muted" style={{ height: 'var(--shell-breadcrumb-height)' }}>
      {/* Organization identity stays visible in every tab: logo, name and the brand-colored edge. */}
      {branded && activeOrganization ? (
        <>
          <span className="mr-1.5 inline-flex items-center gap-1.5 border-r border-border pr-2.5" data-brand-mark>
            <span className="inline-flex size-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[5px]" aria-hidden="true">
              <OrganizationIcon organizationId={activeOrganization.id} iconAssetId={identity.iconAssetId} iconData={identity.iconData} className="object-contain" fallback={<span className="font-display text-[9px] font-bold text-accent">{activeOrganization.name.slice(0, 2).toUpperCase()}</span>} />
            </span>
            <span className="font-display text-[11px] font-bold uppercase tracking-wide text-text">{activeOrganization.name}</span>
          </span>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[2px]" style={{ background: 'linear-gradient(90deg, var(--brand-primary, var(--color-accent)), var(--color-accent) 55%, transparent)' }} />
        </>
      ) : null}
      <span className="font-medium text-text-secondary">{category?.name ?? activeTab.route.categoryId}</span>
      {subcategory && (
        <>
          <CaretRight className="w-3 h-3" />
          <span className="text-text">{subcategory.labelKey ? t(subcategory.labelKey as never) : subcategory.name}</span>
        </>
      )}
    </div>
  );
}
