import { Plus } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n';

export function OrganizationRail() {
  const { organizations, activeOrganization, isLoading, switchOrganization } = useOrganization();
  const { t } = useI18n();

  return (
    <div className="w-14 shrink-0 h-full bg-surface border-r border-border flex flex-col items-center py-3 gap-1.5">
      <div className="h-9 w-9 rounded-xl bg-accent-soft text-accent flex items-center justify-center font-display font-bold text-sm mb-1.5">
        N
      </div>
      <div className="w-6 h-px bg-border mb-1.5" />
      <div className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto w-full px-2">
       
          {isLoading && (
            <>
              <Skeleton className="h-9 w-9 rounded-xl" />
              <Skeleton className="h-9 w-9 rounded-xl" />
            </>
          )}

        {organizations.map((org) => {
          const active = org.id === activeOrganization?.id;
          return (
            <button
              key={org.id}
              type="button"
              title={org.name}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'h-9 w-9 rounded-xl flex items-center justify-center font-display text-sm transition-[background-color,color,border-radius] duration-150 shrink-0',
                active
                  ? 'bg-surface-active text-text font-semibold shadow-soft'
                  : 'bg-surface-hover text-text-secondary hover:bg-surface-active hover:text-text'
              )}
              onClick={() => switchOrganization(org.id)}
            >
              {(org.name ?? '?').charAt(0).toUpperCase()}
            </button>
          );
        })}
        <button
          type="button"
          title={t('rail.addOrg')}
          aria-label={t('rail.addOrg')}
          className="h-9 w-9 rounded-xl border border-dashed border-border-strong text-text-muted hover:text-accent hover:border-accent hover:bg-accent-soft flex items-center justify-center transition-colors duration-150 shrink-0"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}