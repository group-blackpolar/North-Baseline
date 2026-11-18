import { useCallback, useState } from 'react';
import { ClipboardText, Play } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Status } from '@/components/ui/status';
import { useResource } from '@/features/admin-center/hooks';
import { useI18n } from '@/lib/i18n';
import { evaluationsApi, statsApi } from './api';
import { ExamPlayer } from './ExamPlayer';
import { PacedIntro } from './PacedIntro';
import { PacedPlayer } from './PacedPlayer';
import { ResultView } from './ResultView';
import { formatPoints, type AttemptView, type AvailableRow, type EvaluationKind, type ResultView as Result } from './model';

type Mode = { kind: 'list' } | { kind: 'loading' } | { kind: 'taking'; attempt: AttemptView } | { kind: 'result'; result: Result; title: string };

/** Evaluations assigned to the person: start or resume, take in focus mode, see the result. */
export function PlayerPanel({ organizationId, kind }: { organizationId: string; kind?: EvaluationKind }) {
  const { t } = useI18n();
  const rows = useResource(() => evaluationsApi.available(organizationId), [organizationId]);
  const history = useResource(() => statsApi.mine(organizationId), [organizationId]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [intro, setIntro] = useState<AvailableRow | null>(null);

  const start = useCallback(async (row: AvailableRow) => {
    setError(null); setIntro(null); setMode({ kind: 'loading' });
    try { setMode({ kind: 'taking', attempt: await evaluationsApi.startAttempt(organizationId, row.id) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('ev.player.startFailed')); setMode({ kind: 'list' }); void rows.reload(); }
  }, [organizationId, rows, t]);

  if (mode.kind === 'taking') {
    const Player = mode.attempt.pacing.navigation === 'FORWARD_ONLY' ? PacedPlayer : ExamPlayer;
    return <Player organizationId={organizationId} attempt={mode.attempt}
      onExit={() => { setMode({ kind: 'list' }); void rows.reload(); }}
      onFinished={(result) => { setMode({ kind: 'result', result, title: mode.attempt.evaluation.title }); void rows.reload(); void history.reload(); }} />;
  }
  if (mode.kind === 'result') return <ResultView result={mode.result} title={mode.title} onBack={() => setMode({ kind: 'list' })} />;

  const list = (rows.data ?? []).filter((row) => !kind || row.kind === kind);
  return (
    <section aria-label={t('ev.player.title')} className="space-y-3">
      {error ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</p> : null}
      {rows.status === 'loading' || mode.kind === 'loading' ? <Skeleton className="h-28 w-full rounded-xl" />
        : list.length === 0 ? <EmptyState icon={ClipboardText} title={t('ev.player.none')} body={t('ev.player.noneHint')} />
        : <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.map((row) => (
          <li key={row.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
            <div className="min-w-0 space-y-1">
              <h3 className="font-display text-base font-semibold text-text [overflow-wrap:anywhere]">{row.title}</h3>
              {row.description ? <p className="line-clamp-3 text-sm text-text-secondary">{row.description}</p> : null}
              <p className="text-xs text-text-muted">{[t('ev.player.questions', { n: row.questionCount }), row.durationMinutes ? t('ev.player.minutes', { n: row.durationMinutes }) : t('ev.player.untimed'), row.maxAttempts ? t('ev.player.attempts', { used: row.attemptsUsed, max: row.maxAttempts }) : null].filter(Boolean).join(' · ')}</p>
              {row.closesAt ? <p className="text-xs text-text-muted">{t('ev.player.closes', { date: new Date(row.closesAt).toLocaleString() })}</p> : null}
            </div>
            <div className="mt-auto flex items-center justify-between gap-2">
              {row.openAttemptId ? <Status tone="pending">{t('ev.player.inProgress')}</Status> : row.canStart ? <span /> : <Status tone="neutral">{row.opensAt && new Date(row.opensAt) > new Date() ? t('ev.player.opensAt', { date: new Date(row.opensAt).toLocaleString() }) : t('ev.player.unavailable')}</Status>}
              <Button variant="accent" disabled={!row.canStart} onClick={() => { if (row.pacing.navigation === 'FORWARD_ONLY' && !row.openAttemptId) setIntro(row); else void start(row); }}><Play className="size-4" aria-hidden />{row.openAttemptId ? t('ev.player.resume') : t('ev.player.start')}</Button>
            </div>
          </li>))}</ul>}

      {(history.data ?? []).filter((row) => !kind || row.kind === kind).length > 0 ? (
        <section aria-label={t('ev.player.history')} className="space-y-2 pt-2">
          <h3 className="ui-label">{t('ev.player.history')}</h3>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {history.data!.filter((row) => !kind || row.kind === kind).map((row) => (
              <li key={row.attemptId} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                <span className="min-w-0 flex-1 basis-40 truncate font-medium text-text">{row.title} <span className="font-normal text-text-muted">#{row.attemptNumber}</span></span>
                <span className="tabular-nums text-text-secondary">{formatPoints(row.scorePoints)}/{formatPoints(row.maxPoints)} · {row.percent}%</span>
                <span className="text-xs text-text-muted">{row.submittedAt ? new Date(row.submittedAt).toLocaleDateString() : ''}</span>
                <Button size="sm" variant="ghost" onClick={() => void evaluationsApi.result(organizationId, row.attemptId).then((result) => setMode({ kind: 'result', result, title: row.title })).catch((reason) => setError(reason instanceof Error ? reason.message : 'error'))}>{t('ev.results.open')}</Button>
              </li>))}
          </ul>
        </section>) : null}
      <PacedIntro row={intro} onCancel={() => setIntro(null)} onStart={(row) => void start(row)} />
    </section>
  );
}
