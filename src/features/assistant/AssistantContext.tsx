/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useCatalog } from '@/context/CatalogContext';
import { useTabs } from '@/context/TabsContext';
import { useAssistant } from './useAssistant';
import { buildRunContext, clampDockWidth, readDockWidth, type AssistantMode, type PageContext } from './assistantUi';

type Chat = ReturnType<typeof useAssistant>;

interface AssistantUi {
  chat: Chat;
  mode: AssistantMode;
  setMode: (mode: AssistantMode) => void;
  width: number;
  setWidth: (width: number) => void;
  /** Sharing the current page with the assistant is OFF by default and a deliberate, visible choice. */
  share: boolean;
  setShare: (share: boolean) => void;
  /** What would be shared right now (null when the page offers nothing). */
  pageLabel: string | null;
  register: (context: PageContext | null) => void;
  send: (text: string) => Promise<void>;
}

const Context = createContext<AssistantUi | null>(null);
export const EVALUATIONS_CHANGED_EVENT = 'north:evaluations-changed';

/**
 * One assistant for the active organization, shared by every surface (compact card, side panel, full workspace). It lives above the page, so
 * switching mode or navigating keeps the conversation, the in-flight stream and the draft. The keyed organization subtree discards it on a tenant switch.
 */
export function AssistantProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const chat = useAssistant(organizationId);
  const [mode, setModeState] = useState<AssistantMode>('closed');
  const [width, setWidthState] = useState(() => readDockWidth(typeof window === 'undefined' ? null : window.localStorage, typeof window === 'undefined' ? 1280 : window.innerWidth));
  const [share, setShare] = useState(false);
  const [registered, setRegistered] = useState<PageContext | null>(null);
  const { activeTab } = useTabs();
  const { categories } = useCatalog();

  const setMode = useCallback((next: AssistantMode) => setModeState(next), []);
  const setWidth = useCallback((next: number) => {
    const value = clampDockWidth(next, window.innerWidth);
    setWidthState(value);
    try { window.localStorage.setItem('north-assistant-width', String(value)); } catch { /* per-viewer convenience only */ }
  }, []);
  const register = useCallback((context: PageContext | null) => setRegistered(context), []);

  const category = categories.find((item) => item.id === activeTab?.route.categoryId);
  const page = useMemo(() => category?.slug ? { module: category.slug, label: activeTab?.publishedPanel?.title ?? category.name } : null, [category?.slug, category?.name, activeTab?.publishedPanel?.title]);
  const context = useMemo(() => buildRunContext({ share, page, registered }), [share, page, registered]);
  const pageLabel = registered?.label ?? page?.label ?? page?.module ?? null;

  // The latest context is read at send time, never captured by a stale closure.
  const contextRef = useRef(context);
  contextRef.current = context;
  const { send: sendChat, decide: decideChat } = chat;
  const send = useCallback((text: string) => sendChat(text, contextRef.current), [sendChat]);

  // After a confirmed evaluation action, tell the open builder to reload its draft (what changed is data CORECROW already holds).
  const chatWithEvents = useMemo<Chat>(() => ({
    ...chat,
    decide: async (actionId: string, accept: boolean) => {
      await decideChat(actionId, accept);
      if (accept) window.dispatchEvent(new Event(EVALUATIONS_CHANGED_EVENT));
    },
  }), [chat, decideChat]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && mode === 'full') setModeState('side'); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mode]);

  const value = useMemo<AssistantUi>(() => ({ chat: chatWithEvents, mode, setMode, width, setWidth, share, setShare, pageLabel, register, send }), [chatWithEvents, mode, setMode, width, setWidth, share, pageLabel, register, send]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAssistantUi() {
  const value = useContext(Context);
  if (!value) throw new Error('useAssistantUi must be used within AssistantProvider');
  return value;
}
export const useOptionalAssistantUi = () => useContext(Context);

/** A screen offers what it is about (identifiers only). It is cleared when the screen goes away; sharing still needs the person's switch. */
export function useAssistantPage(context: PageContext | null) {
  const ui = useOptionalAssistantUi();
  const register = ui?.register;
  const key = context ? `${context.module}|${context.label ?? ''}|${context.resource?.id ?? ''}` : '';
  useEffect(() => {
    if (!register) return undefined;
    register(context);
    return () => register(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, key]);
}
