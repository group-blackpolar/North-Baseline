import { useState } from 'react';
import { Home, Plus } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { NorthIcon } from '@/components/brand/NorthLogo';
import { pushPath } from '@/lib/routes';

function navigateToOrganization(id: string, slug?: string) {
  const path = id === PERSONAL_ORG_ID ? '/workspace' : (slug ? `/${encodeURIComponent(slug)}` : null);
  if (path) pushPath(path);
}

export function OrganizationRail() {
  const { organizations, activeOrganization, switchOrganization, isLoading } = useOrganization();
  const [modalOpen, setModalOpen] = useState(false);

  // Personal Workspace = entidad especial (botón Home), no una organización
  const orgs = organizations.filter((org) => org.id !== PERSONAL_ORG_ID);
  const personalActive = activeOrganization?.id === PERSONAL_ORG_ID;

  return (
    <div className="w-14 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-3 gap-1.5">
      {/* Branding NORTH */}
        <div className="h-9 w-9 flex items-center justify-center mb-1.5" title="NORTH">
        <NorthIcon className="size-8" />
        </div>

      {/* Personal Workspace */}
      <button
        type="button"
        title="Personal Workspace"
        aria-current={personalActive ? 'true' : undefined}
        className={cn(
          'h-9 w-9 rounded-xl flex items-center justify-center transition-colors duration-150 shrink-0',
          personalActive
            ? 'bg-surface-active text-text shadow-soft ring-1 ring-border'
            : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
        )}
        onClick={() => { switchOrganization(PERSONAL_ORG_ID); navigateToOrganization(PERSONAL_ORG_ID); }}
      >
        <Home className="w-4 h-4" />
      </button>

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
              <button
                key={org.id}
                type="button"
                title={org.name}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center font-display text-sm transition-[background-color,color,box-shadow] duration-150 shrink-0',
                  active
                    ? 'bg-surface-active text-text font-semibold shadow-soft ring-1 ring-border'
                    : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
                )}
                onClick={() => { switchOrganization(org.id); navigateToOrganization(org.id, org.slug); }}
              >
                {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials}
              </button>
            );
          })}

        {/* Crear / unirse */}
        <button
          type="button"
          title="Create or join organization"
          aria-label="Create or join organization"
          className="h-9 w-9 rounded-xl border border-dashed border-border-strong text-text-muted hover:text-accent hover:border-accent hover:bg-accent-soft flex items-center justify-center transition-colors duration-150 shrink-0"
          onClick={() => setModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <OrganizationModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
