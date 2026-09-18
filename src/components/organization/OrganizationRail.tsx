import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useI18n } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { OrganizationModal } from '@/components/organization/OrganizationModal';
import { cn } from '@/lib/utils';

export function OrganizationRail() {
  const { organizations, activeOrganization, switchOrganization, isLoading } = useOrganization();
  const { t } = useI18n();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="w-14 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-3 gap-1.5">
      <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-display font-bold text-sm mb-1.5">N</div>
      <div className="w-6 h-px bg-border mb-1.5" />
      <div className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto w-full px-2">
        {isLoading && <><Skeleton className="h-9 w-9 rounded-xl" /><Skeleton className="h-9 w-9 rounded-xl" /></>}
        {!isLoading && organizations.map((org) => {
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
                'h-9 w-9 rounded-xl overflow-hidden flex items-center justify-center font-display text-sm transition-[background-color,color,border-radius,box-shadow] duration-150 shrink-0',
                active ? 'bg-surface-active text-text font-semibold shadow-soft ring-1 ring-border' : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
              )}
              onClick={() => switchOrganization(org.id)}
            >
              {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials}
            </button>
          );
        })}
        <button
          type="button"
          title={t('org.add')}
          aria-label={t('org.add')}
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