import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { evaluationsApi, type DraftResult, type QuestionInput } from './api';
import type { AuthorQuestion, AuthorView } from './model';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const DEBOUNCE_MS = 900;

/**
 * The editor's connection to the draft. Every write carries the revision it was based on and goes through ONE serialized queue, so
 * revisions never race; typing is optimistic and saved per question after a pause. CORECROW validates everything: a stale revision comes
 * back as EVALUATION_REVISION_CONFLICT and the draft is reloaded instead of overwritten.
 */
export function useDraft(organizationId: string, evaluationId: string, messages: { conflict: string }) {
  const [view, setView] = useState<AuthorView | null>(null);
  const [state, setState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const revision = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const failed = useRef(false);
  const viewRef = useRef<AuthorView | null>(null);
  const timers = useRef(new Map<string, number>());
  const dirty = useRef(new Set<string>());
  viewRef.current = view;

  const load = useCallback(async () => {
    try {
      const next = await evaluationsApi.get(organizationId, evaluationId);
      revision.current = next.draftRevision; viewRef.current = next; dirty.current.clear();
      setView(next); setLoadError(null);
    } catch (reason) { setLoadError(reason instanceof Error ? reason.message : 'error'); }
  }, [evaluationId, organizationId]);
  useEffect(() => { void load(); const pendingTimers = timers.current; return () => { pendingTimers.forEach((id) => window.clearTimeout(id)); }; }, [load]);

  const run = useCallback((op: (rev: number) => Promise<DraftResult>) => {
    pending.current += 1; failed.current = false; setState('saving');
    const task = chain.current.then(async () => {
      try {
        const result = await op(revision.current);
        revision.current = result.draftRevision;
        setView((current) => (current ? { ...current, draftRevision: result.draftRevision, hasUnpublishedChanges: true } : current));
        setError(null);
        return result;
      } catch (reason) {
        failed.current = true;
        if (reason instanceof ApiError && reason.code === 'EVALUATION_REVISION_CONFLICT') { setError(messages.conflict); await load(); }
        else setError(reason instanceof Error ? reason.message : 'error');
        throw reason;
      } finally { pending.current -= 1; setState(pending.current > 0 ? 'saving' : failed.current ? 'error' : 'saved'); }
    });
    chain.current = task.catch(() => undefined);
    return task;
  }, [load, messages.conflict]);

  const questionInput = (q: AuthorQuestion): QuestionInput => ({
    sectionId: q.sectionId, passageId: q.passageId, category: q.category, prompt: q.prompt, explanation: q.explanation, points: q.points,
    options: q.options.map((option) => ({ id: option.id, text: option.text })),
  });

  /** Sends the pending edit of one question now. */
  const commitQuestion = useCallback(async (id: string) => {
    window.clearTimeout(timers.current.get(id)); timers.current.delete(id);
    if (!dirty.current.has(id)) return;
    dirty.current.delete(id);
    const q = viewRef.current?.content.questions.find((item) => item.id === id);
    if (q) await run((rev) => evaluationsApi.updateQuestion(organizationId, evaluationId, id, questionInput(q), rev));
  }, [evaluationId, organizationId, run]);
  const commitAll = useCallback(async () => { await Promise.all([...dirty.current].map((id) => commitQuestion(id).catch(() => undefined))); await chain.current; }, [commitQuestion]);

  /** Optimistic local edit of a question, saved after a pause. */
  const editQuestion = useCallback((id: string, patch: Partial<AuthorQuestion>) => {
    setView((current) => { if (!current) return current; const next = { ...current, content: { ...current.content, questions: current.content.questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) } }; viewRef.current = next; return next; });
    dirty.current.add(id);
    window.clearTimeout(timers.current.get(id));
    timers.current.set(id, window.setTimeout(() => void commitQuestion(id).catch(() => undefined), DEBOUNCE_MS));
    setState('saving');
  }, [commitQuestion]);

  /** A structural change (add, remove, reorder...): pending edits are sent first, then the draft is reloaded for server-made ids. */
  const structural = useCallback(async (op: (rev: number) => Promise<DraftResult>) => {
    await commitAll();
    const result = await run(op);
    await load();
    return result;
  }, [commitAll, load, run]);

  const setCorrect = useCallback(async (questionId: string, optionId: string) => {
    setView((current) => { if (!current) return current; const next = { ...current, content: { ...current.content, questions: current.content.questions.map((q) => (q.id === questionId ? { ...q, correctOptionId: optionId } : q)) } }; viewRef.current = next; return next; });
    await commitQuestion(questionId).catch(() => undefined);
    await run((rev) => evaluationsApi.setCorrectOption(organizationId, evaluationId, questionId, optionId, rev)).catch(() => undefined);
  }, [commitQuestion, evaluationId, organizationId, run]);

  return { view, setView, state, error, loadError, reload: load, run, editQuestion, commitQuestion, commitAll, structural, setCorrect, revision };
}
