import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, BookOpenText, CheckCircle, CloudSlash, Timer, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { portalContainer } from '@/components/ui/portal';
import { Sheet } from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { evaluationsApi } from './api';
import { AnswerSync, remainingSeconds } from './answerSync';
import { Blocks } from './Blocks';
import { formatClock, formatPoints, type AttemptView, type ResultView } from './model';

/**
 * Paced (forward-only) exam player: one open question at a time, each answer CONFIRMED to CORECROW before the next question opens, no way back,
 * a per-question and a global timer. Both clocks are drawn from the SERVER's timestamps (offset-corrected), so reloading, switching tabs or
 * expanding the chapter never changes them; the interface never decides that a late answer is valid: it only asks, and shows what the server answered.
 */
export function PacedPlayer({ organizationId, attempt: initial, onFinished, onExit }: {
  organizationId: string; attempt: AttemptView; onFinished: (result: ResultView) => void; onExit: () => void;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<AttemptView>(initial);
  const loadedAt = useRef(Date.now());
  const questionId = view.current?.questionId ?? null;
  const sync = useRef(new AnswerSync(initial.answers));
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((n) => n + 1), []);
  const [textOpen, setTextOpen] = useState(false);
  const [confirmOmit, setConfirmOmit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const finished = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);
  const shownSection = useRef<string | null>(null);

  const apply = useCallback((next: AttemptView) => {
    loadedAt.current = Date.now();
    if (next.status !== 'IN_PROGRESS' && next.result) { if (!finished.current) { finished.current = true; onFinished(next.result); } return; }
    // A different question opened: its selection starts from what the server holds (nothing, or a reload's draft).
    if (next.current?.questionId !== questionId) sync.current = new AnswerSync(next.answers);
    setView(next);
  }, [onFinished, questionId]);

  const refresh = useCallback(async () => {
    try { apply(await evaluationsApi.getAttempt(organizationId, initial.id)); } catch { /* the next tick retries */ }
  }, [apply, initial.id, organizationId]);

  // One clock for both timers; remaining time is always recomputed from the server's deadline and the offset to its clock.
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id); }, []);
  const left = useCallback((deadline: string | null) => remainingSeconds({ deadlineAt: deadline, serverTime: view.serverTime, clientTimeAtLoad: loadedAt.current, clientNow: now }), [view.serverTime, now]);
  const questionLeft = left(view.current?.expiresAt ?? null);
  const globalLeft = left(view.deadlineAt);

  // When a window ends ask the server what happened (it closes the question at its own deadline). A short delay avoids asking a few ms early.
  const expiredFor = useRef<string | null>(null);
  useEffect(() => {
    const key = `${questionId}:${questionLeft === 0 ? 'q' : ''}${globalLeft === 0 ? 'g' : ''}`;
    if ((questionLeft === 0 || globalLeft === 0) && expiredFor.current !== key) {
      expiredFor.current = key;
      const wait = window.setTimeout(() => void refresh(), 700);
      return () => window.clearTimeout(wait);
    }
    return undefined;
  }, [questionId, questionLeft, globalLeft, refresh]);
  // If the server still reports the same open question after the window, keep asking (clock skew, a slow request).
  useEffect(() => {
    if (questionLeft !== 0 && globalLeft !== 0) return undefined;
    const id = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(id);
  }, [questionLeft, globalLeft, refresh]);

  // Draft selection autosave (the confirmation below is what counts).
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        const batch = sync.current.nextBatch();
        if (!batch.length) break;
        redraw();
        try { sync.current.acknowledge(batch, await evaluationsApi.saveAnswers(organizationId, initial.id, batch)); }
        catch { sync.current.failed(batch); window.setTimeout(() => void flush(), sync.current.retryDelayMs()); break; }
      }
    } finally { flushing.current = false; redraw(); }
  }, [initial.id, organizationId, redraw]);

  const question = view.content?.questions[0] ?? null;
  const passage = view.content?.passages[0] ?? null;
  const progress = view.progress;
  const sections = progress?.sections ?? [];
  const sectionIndex = question ? sections.findIndex((section) => section.id === question.sectionId) : -1;
  const section = sections[sectionIndex] ?? null;
  const selected = question ? sync.current.selected(question.id) : null;

  // Entering a new session is announced, never blocks and never adds time.
  useEffect(() => {
    if (section && shownSection.current !== section.id) {
      if (shownSection.current !== null) setNotice({ tone: 'info', text: t('ev.paced.newSession', { n: sectionIndex + 1, title: section.title }) });
      shownSection.current = section.id;
    }
  }, [section, sectionIndex, t]);
  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); scroller.current?.querySelectorAll('[data-scroll]').forEach((element) => element.scrollTo({ top: 0 })); }, [questionId]);

  const pick = (optionId: string) => { if (!question) return; sync.current.choose(question.id, selected === optionId ? null : optionId); redraw(); void flush(); };

  const confirm = useCallback(async (optionId: string | null) => {
    if (!question || busy) return;
    setBusy(true); setNotice(null);
    // A lost response is safe to repeat: the same confirmation is idempotent on the server.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await evaluationsApi.confirmAnswer(organizationId, initial.id, { questionId: question.id, optionId });
        if (!response.accepted) setNotice({ tone: 'warn', text: response.reason === 'TIMEOUT' ? t('ev.paced.refusedTimeout') : t('ev.paced.refusedClosed') });
        apply(response.attempt);
        setBusy(false);
        return;
      } catch { await new Promise((resolve) => window.setTimeout(resolve, 600 * (attempt + 1))); }
    }
    setNotice({ tone: 'warn', text: t('ev.paced.cannotReach') });
    setBusy(false);
  }, [apply, busy, initial.id, organizationId, question, t]);

  const total = progress?.total ?? 0;
  const urgent = questionLeft !== null && questionLeft <= 20;
  const limit = view.pacing.questionSeconds ?? null;
  const questionPct = limit && questionLeft !== null ? Math.max(0, Math.min(100, (questionLeft / limit) * 100)) : 100;
  const syncState = sync.current.state;
  const doneInSection = useMemo(() => (section ? section.closed : 0), [section]);

  const questionPane = question ? (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text">{t('ev.player.question', { n: (progress?.index ?? 0) + 1 })}</h2>
        <span className="shrink-0 text-xs text-text-muted">{t('ev.player.points', { n: formatPoints(question.points) })}</span>
      </div>
      <Blocks blocks={question.prompt} />
      <fieldset className="space-y-2.5" disabled={busy}>
        <legend className="sr-only">{t('ev.player.options')}</legend>
        {question.options.map((option) => {
          const checked = selected === option.id;
          return (
            <label key={option.id} className={cn('flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-[15px] leading-6 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50',
              checked ? 'border-accent bg-accent/10 text-text' : 'border-border bg-surface text-text hover:bg-surface-hover')}>
              <input type="radio" name={`q-${question.id}`} className="sr-only" checked={checked} onChange={() => pick(option.id)} onClick={() => { if (checked) pick(option.id); }} />
              <span aria-hidden className={cn('mt-px flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', checked ? 'border-accent bg-accent text-white' : 'border-border-strong text-text-secondary')}>{option.label}</span>
              <span className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]">{option.text}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  ) : <div className="flex h-full items-center justify-center p-6 text-sm text-text-muted">{t('ev.paced.closing')}</div>;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={view.evaluation.title} className="fixed inset-0 z-(--z-drawer) flex h-dvh flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-sm font-semibold text-text sm:text-base">{section ? section.title : view.evaluation.title}</h1>
            <p className="truncate text-[11px] text-text-muted">{section ? t('ev.paced.sessionOf', { n: sectionIndex + 1, total: sections.length }) : ''}</p>
          </div>
          <span role="status" className="hidden shrink-0 items-center gap-1 text-[11px] text-text-muted sm:inline-flex">
            {syncState === 'offline' ? <><CloudSlash className="size-3.5 text-warning" aria-hidden />{t('ev.player.offline')}</> : <><CheckCircle className="size-3.5" aria-hidden />{syncState === 'saved' ? t('ev.player.saved') : t('ev.player.saving')}</>}
          </span>
          <div className="flex shrink-0 flex-col items-end leading-tight" aria-label={t('ev.paced.globalTimer')}>
            <span className="text-[10px] uppercase tracking-wide text-text-muted">{t('ev.paced.global')}</span>
            <span role="timer" className="text-sm font-semibold tabular-nums text-text">{globalLeft === null ? '—' : formatClock(globalLeft)}</span>
          </div>
          <div className={cn('flex shrink-0 flex-col items-end rounded-lg border px-2.5 py-1 leading-tight', urgent ? 'border-error/60 bg-error/10 text-error' : 'border-border text-text')} aria-label={t('ev.paced.questionTimer')}>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80"><Timer className="size-3" aria-hidden />{t('ev.paced.question')}</span>
            <span role="timer" className="text-lg font-semibold tabular-nums">{questionLeft === null ? '—' : formatClock(questionLeft)}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onExit} title={t('ev.paced.leaveHint')}>{t('ev.player.leave')}</Button>
        </div>
        <div className="h-1 bg-surface-hover" role="progressbar" aria-label={t('ev.paced.questionTimer')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(questionPct)}><div className={cn('h-full transition-[width] duration-300 ease-linear', urgent ? 'bg-error' : 'bg-accent')} style={{ width: `${questionPct}%` }} /></div>
        <div className="flex items-center justify-between gap-2 px-3 py-1 text-[11px] text-text-muted sm:px-4"><span>{t('ev.paced.progress', { n: (progress?.index ?? 0) + 1, total })}</span><span>{t('ev.paced.inSession', { done: doneInSection, total: section?.total ?? 0 })}</span></div>
        {notice ? <p role={notice.tone === 'warn' ? 'alert' : 'status'} className={cn('flex items-center justify-between gap-2 px-4 py-1.5 text-xs', notice.tone === 'warn' ? 'bg-warning/15 text-warning' : 'bg-accent/10 text-text')}><span className="min-w-0">{notice.text}</span><button type="button" className="shrink-0 underline" onClick={() => setNotice(null)}>{t('ev.player.dismiss')}</button></p> : null}
      </header>

      <main ref={scroller} className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain', passage && 'lg:overflow-hidden')}>
        <div className={cn('min-h-full', passage && 'lg:grid lg:h-full lg:grid-cols-[1fr_1fr]')}>
          {passage ? (
            <section data-scroll aria-label={passage.title} className="hidden min-w-0 overflow-y-auto overscroll-contain border-r border-border bg-surface/50 lg:block">
              <div className="sticky top-0 border-b border-border bg-surface px-5 py-2"><h2 className="truncate text-sm font-semibold text-text">{passage.title}</h2></div>
              <div className="px-5 py-4"><Blocks blocks={passage.body} /></div>
            </section>
          ) : null}
          <section data-scroll className={cn('min-w-0', passage && 'lg:overflow-y-auto lg:overscroll-contain')}>
            {passage ? <div className="px-4 pt-4 sm:px-6 lg:hidden"><Button variant="outline" className="w-full" onClick={() => setTextOpen(true)}><BookOpenText className="size-5" aria-hidden />{t('ev.paced.readChapter')}</Button></div> : null}
            {questionPane}
          </section>
        </div>
      </main>

      <footer className="shrink-0 border-t border-border bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Button className="min-h-11" variant="ghost" disabled={busy || !question} onClick={() => setConfirmOmit(true)}>{t('ev.paced.omit')}</Button>
          <span className="flex-1" />
          <Button className="min-h-11 flex-1 sm:flex-none" variant="accent" loading={busy} disabled={!question || !selected} onClick={() => void confirm(selected)}><span>{t('ev.paced.confirm')}</span><ArrowRight className="size-4" aria-hidden /></Button>
        </div>
        <p className="pt-1 text-center text-[11px] text-text-muted">{t('ev.paced.noBack')}</p>
      </footer>

      {passage ? <Sheet open={textOpen} onOpenChange={setTextOpen} title={passage.title}><Blocks blocks={passage.body} /></Sheet> : null}
      <ConfirmDialog open={confirmOmit} busy={busy} title={t('ev.paced.omitTitle')} description={t('ev.paced.omitBody')} confirmLabel={t('ev.paced.omitConfirm')} onCancel={() => setConfirmOmit(false)} onConfirm={() => { setConfirmOmit(false); void confirm(null); }}>
        <p className="flex items-center gap-2 text-sm text-warning"><WarningCircle className="size-4" aria-hidden />{t('ev.paced.omitHint')}</p>
      </ConfirmDialog>
    </div>,
    portalContainer() ?? document.body,
  );
}
