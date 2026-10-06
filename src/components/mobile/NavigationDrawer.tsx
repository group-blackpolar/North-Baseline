import { useState } from 'react';
import { CaretDown, House, Plus } from '@phosphor-icons/react';
import { Sheet } from '@/components/ui/sheet';
import { Icon } from '@/components/ui/icon';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { ProfileMenu } from '@/components/sidebar/ProfileMenu';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { usePermissions } from '@/context/PermissionContext';
import { useTabs } from '@/context/TabsContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useI18n } from '@/lib/i18n';
import { resolveIcon } from '@/lib/iconMap';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { useCategoryNavigation, useOrganizationNavigation } from '@/lib/shellNavigation';
import type { SessionUser } from '@/lib/auth';
import { cn } from '@/lib/utils';

const row = 'flex min-h-(--touch-min) w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors duration-(--duration-fast)';
const rowState = (active: boolean) => active ? 'bg-surface-active font-medium text-text' : 'text-text-secondary hover:bg-surface-hover hover:text-text';

/** Phone / portrait-tablet navigation: organizations, categories with nested subcategories, profile. Same hooks as the desktop rails. */
export function NavigationDrawer({ open, onOpenChange, user }: { open: boolean; onOpenChange: (open: boolean) => void; user: SessionUser }) {
  const { t } = useI18n();
  const { organizations, activeOrganization, isLoading } = useOrganization();
  const { categories } = useCatalog();
  const { activeTab } = useTabs();
  const { can } = usePermissions();
  const goToOrganization = useOrganizationNavigation();
  const goToCategory = useCategoryNavigation();
  const go = useOverlayHistory(open, () => onOpenChange(false));
  const [orgModal, setOrgModal] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const orgs = organizations.filter((org) => org.id !== PERSONAL_ORG_ID);
  const activeCategoryId = activeTab?.route.categoryId;
  const shownCategory = expanded ?? activeCategoryId;
  const labels: Record<string, string> = { 'platform-administration': t('personal.administration'), home: t('personal.home'), profile: t('personal.profile'), settings: t('home.settings') };

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => { if (!next) go(() => {}); }} side="left" title={t('shell.navigation')} hideTitle footer={<ProfileMenu user={user} />}>
        <nav aria-label={t('shell.organizations')} className="space-y-0.5">
          <button type="button" aria-current={activeOrganization?.id === PERSONAL_ORG_ID ? 'true' : undefined} className={cn(row, rowState(activeOrganization?.id === PERSONAL_ORG_ID))} onClick={() => go(() => goToOrganization({ id: PERSONAL_ORG_ID }))}>
            <Icon icon={House} size="md" />{t('personal.workspace.name')}
          </button>
          {!isLoading && orgs.map((org) => {
            const active = org.id === activeOrganization?.id;
            return (
              <button key={org.id} type="button" aria-current={active ? 'true' : undefined} className={cn(row, rowState(active))} onClick={() => go(() => goToOrganization(org))}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-hover font-display text-[11px]">{((org as { initials?: string }).initials ?? org.name.slice(0, 2)).toUpperCase()}</span>
                <span className="truncate">{org.name}</span>
              </button>
            );
          })}
          <button type="button" className={cn(row, 'text-text-muted hover:text-accent')} onClick={() => setOrgModal(true)}>
            <Icon icon={Plus} size="md" />{t('org.add')}
          </button>
        </nav>

        <div className="my-3 h-px bg-border" />

        <nav aria-label={t('shell.categories')} className="space-y-0.5">
          {categories.map((category) => {
            const CategoryIcon = resolveIcon(category.icon);
            const disabled = Boolean(category.requiredPermission && !can(category.requiredPermission));
            const active = category.id === activeCategoryId;
            const nested = category.subcategories.length > 1 && category.id !== 'platform-administration';
            const open = nested && shownCategory === category.id;
            return (
              <div key={category.id}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={active ? 'page' : undefined}
                  aria-expanded={nested ? open : undefined}
                  className={cn(row, rowState(active), disabled && 'cursor-not-allowed opacity-40')}
                  onClick={() => (nested ? setExpanded(open ? '' : category.id) : go(() => goToCategory(category)))}
                >
                  <Icon icon={CategoryIcon} size="md" />
                  <span className="flex-1 truncate">{labels[category.id] ?? category.name}</span>
                  {nested && <Icon icon={CaretDown} size="xs" className={cn('transition-transform duration-(--duration-fast)', open && 'rotate-180')} />}
                </button>
                {open && (
                  <div className="ml-5 space-y-0.5 border-l border-border pl-2">
                    {category.subcategories.map((sub) => {
                      const SubIcon = resolveIcon(sub.icon);
                      const subActive = active && activeTab?.route.subcategoryId === sub.id;
                      const subDisabled = Boolean(sub.requiredPermission && !can(sub.requiredPermission));
                      return (
                        <button key={sub.id} type="button" disabled={subDisabled} aria-current={subActive ? 'page' : undefined} className={cn(row, 'text-[13px]', rowState(subActive), subDisabled && 'cursor-not-allowed opacity-40')} onClick={() => go(() => goToCategory(category, sub))}>
                          <Icon icon={SubIcon} size="sm" /><span className="truncate">{sub.labelKey ? t(sub.labelKey as never) : sub.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </Sheet>
      <OrganizationModal open={orgModal} onClose={() => setOrgModal(false)} />
    </>
  );
}
