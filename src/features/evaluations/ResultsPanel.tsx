import { useState } from 'react';
import { ArrowLeft, ChartBar } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useResource } from '@/features/admin-center/hooks';
import { useI18n } from '@/lib/i18n';
import { evaluationsApi } from './api';
import { formatPoints, type EvaluationKind, type ResultView as Result } from './model';
import { ResultView } from './ResultView';

const field = 'rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

/** Every attempt of one evaluation with its score, and any result in full (for people holding evaluations.results.read). */
export function ResultsPanel({ organizationId, kind }: { organizationId: string; kind?: EvaluationKind }) {
  const { t } = useI18n();
  const evaluations = useResource(() => evaluationsApi.list(organizationId), [organizationId]);
  const [selected, setSelected] = useState('');
  const [detail, setDetail] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = (evaluations.data ?? []).filter((row) => (!kind || row.kind === kind) && row.currentVersion !== null);
  const evaluationId = selected || list[0]?.id || '';
  const attempts = useResource(() => (evaluationId ? evaluationsApi.attempts(organizationId, evaluationId) : Promise.resolve([])), [organizationId, evaluationId]);

  if (detail) return <div><Button size="sm" variant="ghost" onClick={() => setDetail(null)}><ArrowLeft className="size-4" aria-hidden />{t('ev.builder.back')}</Button><ResultView result={detail} /></div>;
  return (
    <section aria-label={t('ev.results.title')} className="space-y-3">
      {evaluations.status === 'loading' ? <Skeleton className="h-24 w-full rounded-xl" /> : list.length === 0 ? <EmptyState icon={ChartBar} title={t('ev.results.none')} body={t('ev.results.noneHint')} /> : (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm"><span className="ui-label">{t('ev.results.evaluation')}</span><select className={field} value={evaluationId} onChange={(event) => setSelected(event.target.value)}>{list.map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}</select></label>
          {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
          {attempts.status === 'loading' ? <Skeleton className="h-24 w-full rounded-xl" /> : (attempts.data ?? []).length === 0 ? <p className="text-sm text-text-muted">{t('ev.results.noAttempts')}</p> : (
            <div className="max-w-full overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead><tr className="bg-surface-hover text-xs text-text-muted"><th className="px-3 py-2 font-medium">{t('ev.results.person')}</th><th className="px-3 py-2 font-medium">{t('ev.results.attempt')}</th><th className="px-3 py-2 font-medium">{t('ev.results.status')}</th><th className="px-3 py-2 text-right font-medium">{t('ev.results.score')}</th><th className="px-3 py-2" /></tr></thead>
                <tbody>{attempts.data!.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2"><span className="block font-medium text-text">{row.name ?? row.email ?? row.userId}</span>{row.name && row.email ? <span className="block text-xs text-text-muted">{row.email}</span> : null}</td>
                    <td className="px-3 py-2 tabular-nums">#{row.attemptNumber}</td>
                    <td className="px-3 py-2"><Status tone={row.status === 'IN_PROGRESS' ? 'pending' : 'active'}>{t(`ev.attempt.${row.status}`)}</Status></td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.percent !== null ? `${formatPoints(row.scorePoints!)}/${formatPoints(row.maxPoints!)} · ${row.percent}%` : '—'}</td>
                    <td className="px-3 py-2 text-right">{row.status !== 'IN_PROGRESS' ? <Button size="sm" variant="ghost" onClick={() => { setError(null); void evaluationsApi.result(organizationId, row.id).then(setDetail).catch((reason) => setError(reason instanceof Error ? reason.message : 'error')); }}>{t('ev.results.open')}</Button> : null}</td>
                  </tr>))}</tbody>
              </table>
            </div>)}
        </>)}
    </section>
  );
}
