import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { portalContainer } from '@/components/ui/portal';
import { ArrowLeft, ArrowRight, BookOpenText, CheckCircle, CloudSlash, GridFour, Timer, WarningCircle } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { evaluationsApi } from './api';
import { AnswerSync, navigatorItems, remainingSeconds, type SyncState } from './answerSync';
import { Blocks } from './Blocks';
import { formatClock, formatPoints, type AttemptView, type PlayerContent, type PlayerQuestion, type ResultView } from './model';

const SPLITS = [{ id: 'narrow', cols: 'lg:grid-cols-[2fr_3fr]' }, { id: 'even', cols: 'lg:grid-cols-[1fr_1fr]' }, { id: 'wide', cols: 'lg:grid-cols-[3fr_2fr]' }] as const;
type SplitId = (typeof SPLITS)[number]['id'];
const storedSplit = (): SplitId => { try { const value = window.localStorage.getItem('north-exam-split'); return SPLITS.some((s) => s.id === value) ? (value as SplitId) : 'even'; } catch { return 'even'; } };

/**
 * Focus-mode exam player. Everything it shows comes from the authorized attempt payload (no answer key); every choice is autosaved to
 * CORECROW, which is authoritative, so a reload, another tab or a dropped connection never loses an answer. Layout: two columns
 * (reference text | question) from 1024px; one column below, with the text one tap away in a sheet that keeps the question and choice.
 */
export function ExamPlayer({ organizationId, attempt: initial, onFinished, onExit }: {
  organizationId: string; attempt: AttemptView; onFinished: (result: ResultView) => void; onExit: () => void;
}) {
  const { t } = useI18n();
  const content = initial.content as PlayerContent;
  const questions = content.questions;
  const sync = useRef(new AnswerSync(initial.answers));
  const [, setTick] = useState(0);
  const redraw = useCallback(() => setTick((n) => n + 1), []);
  const firstOpen = Math.max(0, questions.findIndex((q) => !sync.current.isAnswered(q.id)));
  const [index, setIndex] = useState(firstOpen);
  const [navOpen, setNavOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [split, setSplit] = useState<SplitId>(storedSplit);
  const loadedAt = useRef(Date.now());
  const [left, setLeft] = useState<number | null>(() => remainingSeconds({ deadlineAt: initial.deadlineAt, serverTime: initial.serverTime, clientTimeAtLoad: loadedAt.current, clientNow: Date.now() }));
  const flushing = useRef(false);
  const retryTimer = useRef<number | undefined>(undefined);
  const finished = useRef(false);
  const scroller = useRef<HTMLDivElement>(null);

  const question = questions[index]!;
  const passage = question.passageId ? content.passages.find((p) => p.id === question.passageId) ?? null : null;
  const section = content.sections.find((s) => s.id === question.sectionId);
  const showSection = Boolean(section && (index === 0 || questions[index - 1]!.sectionId !== question.sectionId));

  const closeWith = useCallback(async () => {
    if (finished.current) return;
    finished.current = true;
    try { const closed = await evaluationsApi.getAttempt(organizationId, initial.id); if (closed.result) onFinished(closed.result); else finished.current = false; }
    catch { finished.current = false; }
  }, [initial.id, onFinished, organizationId]);

  const flush = useCallback(async (): Promise<boolean> => {
    if (flushing.current) return false;
    flushing.current = true;
    try {
      for (;;) {
        const batch = sync.current.nextBatch();
        if (!batch.length) return true;
        redraw();
        try {
          const response = await evaluationsApi.saveAnswers(organizationId, initial.id, batch);
          const { adopted } = sync.current.acknowledge(batch, response);
          if (adopted.length) setNotice(t('ev.player.syncedElsewhere'));
          if (response.status === 'EXPIRED') { void closeWith(); return true; }
          redraw();
        } catch (reason) {
          if (reason instanceof ApiError && reason.status === 409) { void closeWith(); return true; }
          sync.current.failed(batch);
          redraw();
          window.clearTimeout(retryTimer.current);
          retryTimer.current = window.setTimeout(() => void flush(), sync.current.retryDelayMs());
          return false;
        }
      }
    } finally { flushing.current = false; redraw(); }
  }, [closeWith, initial.id, organizationId, redraw, t]);

  const pick = (q: PlayerQuestion, optionId: string) => { sync.current.choose(q.id, sync.current.selected(q.id) === optionId ? null : optionId); redraw(); void flush(); };

  // Reconnect / tab visible again: send what is pending, and never block on it.
  useEffect(() => {
    const retry = () => { if (document.visibilityState === 'visible') void flush(); };
    window.addEventListener('online', retry); document.addEventListener('visibilitychange', retry);
    const warn = (event: BeforeUnloadEvent) => { if (sync.current.hasUnsaved) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => { window.removeEventListener('online', retry); document.removeEventListener('visibilitychange', retry); window.removeEventListener('beforeunload', warn); window.clearTimeout(retryTimer.current); };
  }, [flush]);

  const submit = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      for (let attempt = 0; attempt < 4 && sync.current.hasUnsaved; attempt += 1) { if (!(await flush())) await new Promise((resolve) => window.setTimeout(resolve, 600)); }
      if (sync.current.hasUnsaved) { setError(t('ev.player.cannotSave')); setBusy(false); return; }
      finished.current = true;
      onFinished(await evaluationsApi.submit(organizationId, initial.id));
    } catch (reason) { finished.current = false; setError(reason instanceof Error ? reason.message : t('ev.player.submitFailed')); setBusy(false); }
  }, [flush, initial.id, onFinished, organizationId, t]);

  // Timer: server clock based. At zero the work is sent and the attempt is submitted for the person.
  const submitRef = useRef(submit); submitRef.current = submit;
  useEffect(() => {
    if (initial.deadlineAt === null) return;
    const id = window.setInterval(() => {
      const next = remainingSeconds({ deadlineAt: initial.deadlineAt, serverTime: initial.serverTime, clientTimeAtLoad: loadedAt.current, clientNow: Date.now() });
      setLeft(next);
      if (next === 0 && !finished.current) { window.clearInterval(id); void submitRef.current(); }
    }, 1000);
    return () => window.clearInterval(id);
  }, [initial.deadlineAt, initial.serverTime]);

  useEffect(() => { scroller.current?.scrollTo({ top: 0 }); scroller.current?.querySelectorAll('[data-scroll]').forEach((element) => element.scrollTo({ top: 0 })); }, [index]);
  useEffect(() => { try { window.localStorage.setItem('north-exam-split', split); } catch { /* ignore */ } }, [split]);

  const items = useMemo(() => navigatorItems(questions.map((q) => q.id), index, (id) => sync.current.isAnswered(id)), [questions, index, sync.current.answeredCount()]); // eslint-disable-line react-hooks/exhaustive-deps
  const answered = sync.current.answeredCount();
  const unanswered = questions.length - answered;
  const state: SyncState = sync.current.state;
  const last = index === questions.length - 1;
  const lowTime = left !== null && left <= 300;

  const navigator = (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2" role="list" aria-label={t('ev.player.navigator')}>
      {items.map((item) => (
        <button key={item.id} type="button" role="listitem" aria-current={item.tone === 'current' ? 'step' : undefined}
          aria-label={t('ev.player.goTo', { n: item.number, state: t(item.tone === 'answered' ? 'ev.player.answered' : 'ev.player.pending') })}
          onClick={() => { setIndex(item.number - 1); setNavOpen(false); }}
          className={cn('flex h-11 items-center justify-center rounded-lg border text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/50',
            item.tone === 'current' ? 'border-accent bg-accent text-white' : item.tone === 'answered' ? 'border-success/40 bg-success/10 text-text' : 'border-border bg-surface text-text-secondary hover:bg-surface-hover')}>
          {item.number}
        </button>
      ))}
    </div>
  );

  const questionPane = (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-5 sm:px-6">
      {showSection ? <p className="ui-label">{section!.title}</p> : null}
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-text">{t('ev.player.question', { n: index + 1 })}</h2>
        <span className="shrink-0 text-xs text-text-muted">{t('ev.player.points', { n: formatPoints(question.points) })}</span>
      </div>
      <Blocks blocks={question.prompt} />
      <fieldset className="space-y-2.5">
        <legend className="sr-only">{t('ev.player.options')}</legend>
        {question.options.map((option) => {
          const checked = sync.current.selected(question.id) === option.id;
          return (
            <label key={option.id} className={cn('flex min-h-14 cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-[15px] leading-6 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/50',
              checked ? 'border-accent bg-accent/10 text-text' : 'border-border bg-surface text-text hover:bg-surface-hover')}>
              <input type="radio" name={`q-${question.id}`} className="sr-only" checked={checked} onChange={() => pick(question, option.id)} onClick={() => { if (checked) pick(question, option.id); }} />
              <span aria-hidden className={cn('mt-px flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold', checked ? 'border-accent bg-accent text-white' : 'border-border-strong text-text-secondary')}>{option.label}</span>
              <span className="min-w-0 flex-1 pt-0.5 [overflow-wrap:anywhere]">{option.text}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );

  // Mounted in the shell (not in the page grid, whose zoom/transform would become the containing block of `fixed`), like every overlay. Sits at the drawer layer so its own sheets (same layer, mounted later) and dialogs open above it.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={initial.evaluation.title} className="fixed inset-0 z-(--z-drawer) flex h-dvh flex-col bg-background">
      <header className="shrink-0 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-sm font-semibold text-text sm:text-base">{initial.evaluation.title}</h1>
            <p className="text-[11px] text-text-muted">{t('ev.player.progress', { done: answered, total: questions.length })}</p>
          </div>
          <SaveBadge state={state} t={t} />
          {left !== null ? (
            <span role="timer" aria-label={t('ev.player.timeLeft')} className={cn('inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-sm font-semibold tabular-nums', lowTime ? 'border-error/50 bg-error/10 text-error' : 'border-border text-text')}>
              <Timer className="size-4" aria-hidden />{formatClock(left)}
            </span>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onExit}>{t('ev.player.leave')}</Button>
        </div>
        <div className="h-1 bg-surface-hover" role="progressbar" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answered}><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${(answered / questions.length) * 100}%` }} /></div>
        {notice ? <p role="status" className="flex items-center justify-between gap-2 bg-accent/10 px-4 py-1.5 text-xs text-text">{notice}<button type="button" className="underline" onClick={() => setNotice(null)}>{t('ev.player.dismiss')}</button></p> : null}
      </header>

      <div className="flex min-h-0 flex-1">
        <main ref={scroller} className={cn('min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain', passage && 'lg:overflow-hidden')}>
          <div className={cn('min-h-full', passage && ['lg:grid lg:h-full', SPLITS.find((s) => s.id === split)!.cols])}>
            {passage ? (
              <section data-scroll aria-label={passage.title || t('ev.player.text')} className="hidden min-w-0 overflow-y-auto overscroll-contain border-r border-border bg-surface/50 lg:block">
                <div className="sticky top-0 flex items-center justify-between gap-2 border-b border-border bg-surface px-5 py-2">
                  <h2 className="truncate text-sm font-semibold text-text">{passage.title || t('ev.player.text')}</h2>
                  <div className="flex shrink-0 gap-1" role="group" aria-label={t('ev.player.split')}>
                    {SPLITS.map((s) => <button key={s.id} type="button" aria-pressed={split === s.id} onClick={() => setSplit(s.id)} className={cn('rounded px-2 py-1 text-[11px]', split === s.id ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-hover')}>{t(`ev.player.split.${s.id}`)}</button>)}
                  </div>
                </div>
                <div className="px-5 py-4"><Blocks blocks={passage.body} /></div>
              </section>
            ) : null}
            <section data-scroll className={cn('min-w-0', passage && 'lg:overflow-y-auto lg:overscroll-contain')}>
              {passage ? <div className="px-4 pt-4 sm:px-6 lg:hidden"><Button variant="outline" size="md" className="w-full" onClick={() => setTextOpen(true)}><BookOpenText className="size-5" aria-hidden />{t('ev.player.readText')}</Button></div> : null}
              {questionPane}
            </section>
          </div>
        </main>
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-l border-border bg-surface p-4 xl:block" aria-label={t('ev.player.navigator')}>
          <h2 className="ui-label pb-3">{t('ev.player.navigator')}</h2>
          {navigator}
          <p className="pt-3 text-xs text-text-muted">{t('ev.player.legend')}</p>
        </aside>
      </div>

      <footer className="shrink-0 border-t border-border bg-surface px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
        <div className="mx-auto flex max-w-3xl items-center gap-2 xl:max-w-none">
          <Button className="min-h-11 flex-1 sm:flex-none" variant="outline" disabled={index === 0} onClick={() => setIndex(index - 1)}><ArrowLeft className="size-4" aria-hidden /><span>{t('ev.player.prev')}</span></Button>
          <Button className="min-h-11 shrink-0 xl:hidden" variant="ghost" aria-label={t('ev.player.navigator')} onClick={() => setNavOpen(true)}><GridFour className="size-5" aria-hidden /><span className="text-xs tabular-nums">{index + 1}/{questions.length}</span></Button>
          <span className="hidden flex-1 xl:block" />
          {last
            ? <Button className="min-h-11 flex-1 sm:flex-none" variant="accent" onClick={() => setConfirm(true)}><CheckCircle className="size-4" aria-hidden /><span>{t('ev.player.finish')}</span></Button>
            : <Button className="min-h-11 flex-1 sm:flex-none" variant="primary" onClick={() => setIndex(index + 1)}><span>{t('ev.player.next')}</span><ArrowRight className="size-4" aria-hidden /></Button>}
          {!last ? <Button className="hidden min-h-11 xl:inline-flex" variant="ghost" onClick={() => setConfirm(true)}>{t('ev.player.finish')}</Button> : null}
        </div>
      </footer>

      <Sheet open={navOpen} onOpenChange={setNavOpen} title={t('ev.player.navigator')} description={t('ev.player.legend')}>{navigator}</Sheet>
      {passage ? <Sheet open={textOpen} onOpenChange={setTextOpen} title={passage.title || t('ev.player.text')}><Blocks blocks={passage.body} /></Sheet> : null}
      <ConfirmDialog open={confirm} busy={busy} error={error} title={t('ev.player.confirmTitle')} confirmLabel={t('ev.player.confirmSubmit')} onCancel={() => { setConfirm(false); setError(null); }} onConfirm={() => void submit()}
        description={unanswered > 0 ? t('ev.player.confirmUnanswered', { n: unanswered }) : t('ev.player.confirmAll')}>
        {unanswered > 0 ? <p className="flex items-center gap-2 text-sm text-warning"><WarningCircle className="size-4" aria-hidden />{t('ev.player.confirmHint')}</p> : null}
      </ConfirmDialog>
    </div>,
    portalContainer() ?? document.body,
  );
}

function SaveBadge({ state, t }: { state: SyncState; t: (key: 'ev.player.saved' | 'ev.player.saving' | 'ev.player.offline') => string }) {
  if (state === 'offline') return <span role="status" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-1 text-[11px] font-medium text-warning"><CloudSlash className="size-3.5" aria-hidden /><span className="hidden sm:inline">{t('ev.player.offline')}</span></span>;
  if (state === 'saved') return <span role="status" className="inline-flex shrink-0 items-center gap-1 text-[11px] text-text-muted"><CheckCircle className="size-3.5" aria-hidden /><span className="hidden sm:inline">{t('ev.player.saved')}</span></span>;
  return <span role="status" className="inline-flex shrink-0 items-center gap-1 text-[11px] text-text-muted"><span className="size-2 animate-pulse rounded-full bg-accent" aria-hidden /><span className="hidden sm:inline">{t('ev.player.saving')}</span></span>;
}
