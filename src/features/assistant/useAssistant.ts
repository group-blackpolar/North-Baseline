import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import { uuid } from '@/lib/utils';
import { cancelRun, createConversation, createRun, listConversations, readConversation, streamRun } from './api.ts';
import { chatReducer, initialChatState } from './protocol.ts';

const codeOf = (error: unknown) => {
  if (error instanceof ApiError) return error.code ?? (error.status === 429 ? 'RATE_LIMITED' : error.status === 403 ? 'AI_PERMISSION_DENIED' : error.status === 503 ? 'AI_DISABLED' : 'AI_RUN_FAILED');
  return 'AI_RUN_FAILED';
};

/**
 * One assistant conversation for ONE organization. Nothing is persisted in the browser (no localStorage): the conversation lives
 * in CORECROW. Everything in flight (requests and the event stream) is aborted when the component unmounts or the organization
 * changes, and the state is dropped with it, so nothing can cross tenants.
 */
export function useAssistant(organizationId: string) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const loaded = useRef(false);
  const runId = useRef<string | null>(null);
  runId.current = state.runId;
  // The reducer owns the conversation id; callbacks read it through a ref to stay stable across renders.
  const conversationRef = useRef<string | null>(null);
  conversationRef.current = state.conversationId;

  useEffect(() => {
    dispatch({ type: 'reset' });
    loaded.current = false;
    setLoadError(null);
    return () => { controller.current?.abort(); controller.current = null; };
  }, [organizationId]);

  /** Resumes the most recent conversation of this organization, once. */
  const load = useCallback(async () => {
    if (loaded.current) return;
    loaded.current = true;
    setLoading(true); setLoadError(null);
    try {
      const [latest] = await listConversations(organizationId);
      if (latest) {
        const stored = await readConversation(organizationId, latest.id);
        dispatch({ type: 'loaded', conversationId: stored.id, messages: stored.messages });
      }
    } catch (error) { loaded.current = false; setLoadError(codeOf(error)); }
    finally { setLoading(false); }
  }, [organizationId]);

  const send = useCallback(async (message: string) => {
    const text = message.trim();
    if (!text) return;
    controller.current?.abort();
    const mine = new AbortController();
    controller.current = mine;
    dispatch({ type: 'sending', localId: uuid(), text });
    try {
      let conversationId = conversationRef.current;
      if (!conversationId) {
        conversationId = (await createConversation(organizationId)).id;
        dispatch({ type: 'conversation', conversationId });
      }
      const { runId: created } = await createRun(organizationId, conversationId, text);
      if (mine.signal.aborted) return;
      dispatch({ type: 'run.created', runId: created });
      await streamRun({ organizationId, runId: created, signal: mine.signal, onEvent: (event) => { if (!mine.signal.aborted) dispatch({ type: 'event', event }); } });
    } catch (error) {
      if (!mine.signal.aborted) dispatch({ type: 'failed', code: codeOf(error) });
    }
  }, [organizationId]);

  const cancel = useCallback(async () => {
    if (!runId.current) return;
    dispatch({ type: 'cancelling' });
    try { await cancelRun(organizationId, runId.current); } catch { /* the stream still reports the real outcome */ }
  }, [organizationId]);

  const startOver = useCallback(() => {
    controller.current?.abort();
    controller.current = null;
    dispatch({ type: 'reset' });
    loaded.current = true; // a new conversation must not be replaced by the previous one
  }, []);

  return { state, loading, loadError, load, send, cancel, startOver };
}
