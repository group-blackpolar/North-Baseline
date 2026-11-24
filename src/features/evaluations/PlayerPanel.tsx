import { useCallback, useEffect, useRef, useState } from 'react';
import { ClipboardText } from '@phosphor-icons/react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useResource } from '@/features/admin-center/hooks';
import { useI18n } from '@/lib/i18n';
import { categoriesApi, evaluationsApi } from './api';
import { CategoryGrid } from './CategoryCards';
import { CategoryView } from './CategoryView';
import { ExamPlayer } from './ExamPlayer';
import { PacedIntro } from './PacedIntro';
import { PacedPlayer } from './PacedPlayer';
import { ResultView } from './ResultView';
import type { AttemptView, AvailableRow, EvaluationKind, ResultView as Result } from './model';

type Mode = { kind: 'list' } | { kind: 'loading' } | { kind: 'taking'; attempt: AttemptView } | { kind: 'result'; result: Result; title: string };

/**
 * Stress Test for the person taking exams: category cards -> the exams of a category grouped by state -> intro -> player -> result / review.
 * Categories, counts, states and grades are read from CORECROW (nothing is a frontend constant).
 */
export function PlayerPanel({ organizationId, kind }: { organizationId: string; kind?: EvaluationKind }) {
  const { t } = useI18n();
  const rows = useResource(() => evaluationsApi.available(organizationId), [organizationId]);
  const categories = useResource(() => categoriesApi.list(organizationId), [organizationId]);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [error, setError] = useState<string | null>(null);
  const [intro, setIntro] = useState<AvailableRow | null>(null);
  const [open, setOpen] = useState<string | null>(null); // category key; '' = exams without category; null = home

  const refresh = useCallback(() => { void rows.reload(); void categories.reload(); }, [rows, categories]);
  // What an administrator changes (a category image, a new exam, a state) shows up here without signing in again: on returning to the tab and every 30 s while the list is on screen.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const listing = mode.kind === 'list';
  useEffect(() => {
    if (!listing) return undefined;
    const tick = () => { if (document.visibilityState === 'visible') refreshRef.current(); };
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', tick); window.removeEventListener('focus', tick); };
  }, [listing]);
  const start = useCallback(async (row: AvailableRow) => {
    setError(null); setIntro(null); setMode({ kind: 'loading' });
    try { setMode({ kind: 'taking', attempt: await evaluationsApi.startAttempt(organizationId, row.id) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : t('ev.player.startFailed')); setMode({ kind: 'list' }); refresh(); }
  }, [organizationId, refresh, t]);
  const review = useCallback((attemptId: string, title: string) => {
    setError(null);
    void evaluationsApi.result(organizationId, attemptId).then((result) => setMode({ kind: 'result', result, title })).catch((reason) => setError(reason instanceof Error ? reason.message : 'error'));
  }, [organizationId]);

  if (mode.kind === 'taking') {
    const Player = mode.attempt.pacing.navigation === 'FORWARD_ONLY' ? PacedPlayer : ExamPlayer;
    return <Player organizationId={organizationId} attempt={mode.attempt} onExit={() => { setMode({ kind: 'list' }); refresh(); }}
      onFinished={(result) => { setMode({ kind: 'result', result, title: mode.attempt.evaluation.title }); refresh(); }} />;
  }
  if (mode.kind === 'result') return <ResultView result={mode.result} title={mode.title} onBack={() => setMode({ kind: 'list' })} />;

  const exams = (rows.data ?? []).filter((row) => !kind || row.kind === kind);
  const view = categories.data;
  const known = new Set((view?.categories ?? []).map((category) => category.id));
  const selected = open === null || !view ? null : open === '' ? { name: t('st.cat.uncategorized'), description: t('st.cat.uncategorizedHint'), rows: exams.filter((row) => !row.categoryId || !known.has(row.categoryId)) }
    : (() => { const category = view.categories.find((item) => item.key === open); return category ? { name: category.name, description: category.description, rows: exams.filter((row) => row.categoryId === category.id) } : null; })();

  return (
    <section aria-label={t('ev.player.title')} className="space-y-3">
      {error ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{error}</p> : null}
      {rows.status === 'loading' || categories.status === 'loading' || mode.kind === 'loading' ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
        : categories.status === 'error' || !view ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">{t('st.home.error')}</p>
        : selected ? <CategoryView name={selected.name} description={selected.description} rows={selected.rows} onBack={() => setOpen(null)} onStart={(row) => { if (row.pacing.navigation === 'FORWARD_ONLY' && !row.openAttemptId) setIntro(row); else void start(row); }} onReview={review} />
        : view.categories.length === 0 && view.uncategorized.total === 0 ? <EmptyState icon={ClipboardText} title={t('ev.player.none')} body={t('ev.player.noneHint')} />
        : <><p className="text-sm text-text-secondary">{t('st.home.hint')}</p><CategoryGrid organizationId={organizationId} view={view} onOpen={setOpen} /></>}
      <PacedIntro row={intro} onCancel={() => setIntro(null)} onStart={(row) => void start(row)} />
    </section>
  );
}
