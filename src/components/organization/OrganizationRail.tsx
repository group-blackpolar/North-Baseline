import { useState } from 'react';
import { House, Plus } from '@phosphor-icons/react';
import { useOrganization } from '@/context/OrganizationContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { NorthIcon } from '@/components/brand/NorthLogo';
import { useOrganizationNavigation } from '@/lib/shellNavigation';
import { useI18n } from '@/lib/i18n';

export function OrganizationRail() {
  const { t } = useI18n();
  const { organizations, activeOrganization, isLoading } = useOrganization();
  const goToOrganization = useOrganizationNavigation();
  const [modalOpen, setModalOpen] = useState(false);

  // Personal Workspace = entidad especial (botón Home), no una organización
  const orgs = organizations.filter((org) => org.id !== PERSONAL_ORG_ID);
  const personalActive = activeOrganization?.id === PERSONAL_ORG_ID;

  return (
    <nav aria-label={t('shell.organizations')} className="shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-2.5 gap-1.5" style={{ width: 'var(--shell-org-rail)' }}>
      {/* Branding NORTH */}
        <div className="h-9 w-9 flex items-center justify-center mb-1.5" title="NORTH">
        <NorthIcon className="size-8" />
        </div>

      {/* Personal Workspace */}
      <Tooltip label={t('personal.workspace.name')} side="right">
      <button
        type="button"
        aria-label={t('personal.workspace.name')}
        aria-current={personalActive ? 'true' : undefined}
        className={cn(
          'np-press h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-(--duration-fast) shrink-0',
          personalActive
            ? 'bg-surface-active text-text shadow-soft ring-1 ring-border'
            : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
        )}
        onClick={() => goToOrganization({ id: PERSONAL_ORG_ID })}
      >
        <House className="w-4 h-4" />
      </button>
      </Tooltip>

      <div className="w-6 h-px bg-border my-1" />

      {/* Organizaciones */}
      <div className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto w-full px-2">
        {isLoading && (
          <>
            <Skeleton className="h-9 w-9 rounded-xl" />
            <Skeleton className="h-9 w-9 rounded-xl" />
          </>
        )}
        {!isLoading &&
          orgs.map((org) => {
            const active = org.id === activeOrganization?.id;
            const avatar = (org as { avatarUrl?: string | null }).avatarUrl ?? null;
            const initials = (org as { initials?: string }).initials ?? (org.name ?? '?').slice(0, 2).toUpperCase();
            return (
              <Tooltip key={org.id} label={org.name} side="right">
              <button
                type="button"
                aria-label={org.name}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'np-press h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center font-display text-sm transition-[background-color,color,box-shadow] duration-(--duration-fast) shrink-0',
                  active
                    ? 'bg-surface-active text-text font-semibold shadow-soft ring-1 ring-border'
                    : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
                )}
                onClick={() => goToOrganization(org)}
              >
                {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials}
              </button>
              </Tooltip>
            );
          })}

        {/* Crear / unirse */}
        <Tooltip label={t('org.add')} side="right">
        <button
          type="button"
          aria-label={t('org.add')}
          className="np-press h-9 w-9 rounded-xl border border-dashed border-border-strong text-text-muted hover:text-accent hover:border-accent hover:bg-accent-soft flex items-center justify-center transition-colors duration-(--duration-fast) shrink-0"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
        </button>
        </Tooltip>
      </div>

      <OrganizationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </nav>
  );
}
