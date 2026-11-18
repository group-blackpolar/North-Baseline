import { useEffect, useState } from 'react';
import { ShieldWarning } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { BuilderPanel } from './BuilderPanel';
import type { EvaluationKind } from './model';
import { PlayerPanel } from './PlayerPanel';
import { ResultsPanel } from './ResultsPanel';

type View = 'builder' | 'player' | 'results';
const ALL: View[] = ['builder', 'player', 'results'];

/**
 * Organization-neutral evaluations workspace (ADR 029): a panel decides which views it offers and which kind (exam / form) it lists;
 * each view appears only to members who hold its permission, and CORECROW authorizes every request. Nothing here names a tenant or an exam.
 */
export function EvaluationsWorkspace({ organizationId, views, kind }: { organizationId: string; views: View[]; kind?: EvaluationKind }) {
  const { t } = useI18n();
  const { can, isLoading } = usePermissions();
  const allowed: Record<View, boolean> = {
    builder: can('evaluations.read') || can('evaluations.update'),
    player: can('evaluations.take'),
    results: can('evaluations.results.read'),
  };
  const offered = ALL.filter((view) => views.includes(view) && allowed[view]);
  const [view, setView] = useState<View | null>(null);
  const active = view && offered.includes(view) ? view : offered[0] ?? null;
  useEffect(() => { setView(null); }, [organizationId]);

  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;
  if (!active) return <div className="mx-auto max-w-md p-6"><EmptyState icon={ShieldWarning} title={t('ev.noAccess')} body={t('ev.noAccessHint')} /></div>;
  return (
    <section aria-label={t('ev.workspace')} className="space-y-4">
      {offered.length > 1 ? (
        <div role="tablist" aria-label={t('ev.workspace')} className="flex gap-1 overflow-x-auto border-b border-border">
          {offered.map((id) => <button key={id} type="button" role="tab" aria-selected={active === id} onClick={() => setView(id)} className={cn('shrink-0 border-b-2 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-accent/40', active === id ? 'border-accent text-text' : 'border-transparent text-text-secondary hover:text-text')}>{t(`ev.view.${id}`)}</button>)}
        </div>
      ) : null}
      {active === 'builder' ? <BuilderPanel organizationId={organizationId} kind={kind} can={{ create: can('evaluations.create'), update: can('evaluations.update'), delete: can('evaluations.delete'), publish: can('evaluations.publish'), manage: can('evaluations.manage') }} /> : null}
      {active === 'player' ? <PlayerPanel organizationId={organizationId} kind={kind} /> : null}
      {active === 'results' ? <ResultsPanel organizationId={organizationId} kind={kind} /> : null}
    </section>
  );
}

/** Adapter for a published panel component (`evaluation_workspace`): validates the untrusted props before using them. */
export function EvaluationsWorkspaceHost({ organizationId, props }: { organizationId: string | null | undefined; props: Record<string, unknown> }) {
  if (!organizationId) return null;
  const views = (Array.isArray(props.views) ? props.views : []).filter((view): view is View => ALL.includes(view as View));
  const kind = props.kind === 'EXAM' || props.kind === 'FORM' ? props.kind : undefined;
  return <EvaluationsWorkspace organizationId={organizationId} views={views.length ? views : ALL} kind={kind} />;
}
