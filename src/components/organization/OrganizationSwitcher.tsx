import { useEffect, useState } from 'react';
import { Check, CaretUpDown, House, Plus } from '@phosphor-icons/react';
import { useOrganization } from '@/context/OrganizationContext';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { OrganizationIcon } from '@/components/organization/OrganizationAvatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useOrganizationNavigation } from '@/lib/shellNavigation';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

type OrganizationLike = { id: string; name?: string; avatarUrl?: string | null; initials?: string; iconAssetId?: string | null };

const initialsOf = (org: OrganizationLike) => org.initials ?? (org.name ?? '?').slice(0, 2).toUpperCase();

function Avatar({ org, size }: { org: OrganizationLike; size: 'sm' | 'md' }) {
  const personal = org.id === PERSONAL_ORG_ID;
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-hover font-display font-semibold text-text', size === 'md' ? 'size-9 text-sm' : 'size-7 text-xs')} aria-hidden="true">
      {personal
        ? <House className="size-4" />
        : <OrganizationIcon organizationId={org.id} iconAssetId={org.iconAssetId} iconData={org.avatarUrl ?? null} fallback={initialsOf(org)} />}
    </span>
  );
}

/**
 * The organization (or personal workspace) selector that replaces the old organization rail (UX-01c). Expanded it is the
 * header button of the navigation bar; collapsed it is just the avatar. The menu is fixed-positioned so no scroll area clips it.
 */
export function OrganizationSwitcher({ collapsed }: { collapsed: boolean }) {
  const { t } = useI18n();
  const { organizations, activeOrganization, isLoading } = useOrganization();
  const goToOrganization = useOrganizationNavigation();
  const [menu, setMenu] = useState<{ top: number; left: number; width: number } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!menu) return;
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) { if (event.key === 'Escape') setMenu(null); return; }
      if (!(event.target as Element).closest('[data-org-switcher]')) setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menu]);

  if (isLoading || !activeOrganization) return <Skeleton className={collapsed ? 'size-9 rounded-lg' : 'h-12 w-full rounded-lg'} />;

  const personalActive = activeOrganization.id === PERSONAL_ORG_ID;
  const name = personalActive ? t('personal.workspace.name') : (activeOrganization.name ?? '');
  const orgs = organizations.filter((org) => org.id !== PERSONAL_ORG_ID);
  const personal = organizations.find((org) => org.id === PERSONAL_ORG_ID) ?? { id: PERSONAL_ORG_ID };
  const choose = (org: OrganizationLike) => { setMenu(null); goToOrganization(org); };

  const trigger = (
    <button
      type="button"
      data-org-switcher
      aria-haspopup="menu"
      aria-expanded={Boolean(menu)}
      aria-label={collapsed ? name : t('shell.organizations')}
      title={name}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        setMenu(menu ? null : collapsed ? { top: rect.top, left: rect.right + 8, width: 256 } : { top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 232) });
      }}
      className={cn(
        'np-press-flat flex items-center gap-2.5 rounded-lg transition-colors duration-(--shell-motion-fast) hover:bg-surface-hover',
        collapsed ? 'size-9 justify-center' : 'w-full border border-border bg-surface p-2 text-left',
      )}
    >
      <Avatar org={activeOrganization as OrganizationLike} size={collapsed ? 'sm' : 'md'} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-text">{name}</span>
            <span className="block truncate text-[11px] text-text-muted">{personalActive ? t('org.personalActive') : t('org.active')}</span>
          </span>
          <CaretUpDown className="size-4 shrink-0 text-text-muted" />
        </>
      )}
    </button>
  );

  return (
    <>
      {collapsed ? <Tooltip label={menu ? '' : name} side="right">{trigger}</Tooltip> : trigger}
      {menu && (
        <div role="menu" data-org-switcher aria-label={t('shell.organizations')} style={{ top: menu.top, left: menu.left, width: menu.width }} className="north-enter fixed z-(--z-popover) max-h-[70vh] overflow-y-auto rounded-lg border border-border bg-surface p-1.5 shadow-pop">
          {[personal as OrganizationLike, ...(orgs as OrganizationLike[])].map((org, index) => {
            const active = org.id === activeOrganization.id;
            return (
              <div key={org.id}>
                {index === 1 && orgs.length > 0 && <p className="ui-label px-2 pb-1 pt-2">{t('org.list')}</p>}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(org)}
                  className={cn('flex w-full items-center gap-2.5 rounded-md p-1.5 text-left text-[13px] transition-colors duration-(--shell-motion-fast)', active ? 'bg-surface-active text-text' : 'text-text-secondary hover:bg-surface-hover hover:text-text')}
                >
                  <Avatar org={org} size="sm" />
                  <span className="min-w-0 flex-1 truncate font-medium">{org.id === PERSONAL_ORG_ID ? t('personal.workspace.name') : org.name}</span>
                  {active && <Check className="size-4 shrink-0 text-accent" />}
                </button>
              </div>
            );
          })}
          <div className="mt-1 border-t border-border pt-1">
            <button type="button" role="menuitem" onClick={() => { setMenu(null); setModalOpen(true); }} className="flex w-full items-center gap-2.5 rounded-md p-1.5 text-left text-[13px] text-text-secondary transition-colors duration-(--shell-motion-fast) hover:bg-surface-hover hover:text-text">
              <span className="flex size-7 items-center justify-center rounded-lg border border-dashed border-border-strong"><Plus className="size-4" /></span>
              {t('org.add')}
            </button>
          </div>
        </div>
      )}
      <OrganizationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
