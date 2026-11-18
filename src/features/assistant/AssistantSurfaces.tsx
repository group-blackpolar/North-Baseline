import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { ChatCircleText, ListBullets, Plus, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Sheet } from '@/components/ui/sheet';
import { portalContainer } from '@/components/ui/portal';
import { useI18n } from '@/lib/i18n';
import { useIsCompactShell } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import { AssistantPanel } from './AssistantPanel';
import { useAssistantUi } from './AssistantContext';
import { DOCK_DEFAULT, DOCK_MAX, DOCK_MIN } from './assistantUi';

/** Side panel next to the page (desktop). The page keeps its place and shrinks; the handle resizes it with the pointer or the arrow keys. */
export function AssistantDock() {
  const { t } = useI18n();
  const { mode, width, setWidth, setMode } = useAssistantUi();
  const [dragging, setDragging] = useState(false);
  const aside = useRef<HTMLElement>(null);
  const compact = useIsCompactShell();
  if (mode !== 'side' || compact) return null;

  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const right = aside.current?.getBoundingClientRect().right ?? window.innerWidth;
    setWidth(right - event.clientX);
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); setWidth(width + 24); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setWidth(width - 24); }
    else if (event.key === 'Home') { event.preventDefault(); setWidth(DOCK_MIN); }
    else if (event.key === 'End') { event.preventDefault(); setWidth(DOCK_MAX); }
  };
  return (
    <aside ref={aside} aria-label={t('assistant.name')} style={{ width }} className={cn('relative flex shrink-0 flex-col border-l border-border bg-surface', !dragging && 'transition-[width] duration-150 motion-reduce:transition-none')}>
      <div
        role="separator" aria-orientation="vertical" aria-label={t('assistant.resize')} aria-valuemin={DOCK_MIN} aria-valuemax={DOCK_MAX} aria-valuenow={width} tabIndex={0}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); }}
        onPointerMove={move} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}
        onDoubleClick={() => setWidth(DOCK_DEFAULT)} onKeyDown={keys}
        className={cn('absolute inset-y-0 -left-1 z-10 w-2 cursor-col-resize touch-none outline-none hover:bg-accent/30 focus-visible:bg-accent/50', dragging && 'bg-accent/40')}
      />
      <AssistantPanel variant="side" onClose={() => setMode('closed')} />
    </aside>
  );
}

/** Everything else the mode needs: the compact card, the phone sheets and the full workspace. One instance per shell. */
export function AssistantSurfaces() {
  const { t } = useI18n();
  const ui = useAssistantUi();
  const compact = useIsCompactShell();
  const { mode, setMode } = ui;
  const close = useCallback(() => setMode('closed'), [setMode]);

  useEffect(() => {
    if (mode !== 'compact' || compact) return undefined;
    const onKey = (event: KeyboardEvent | globalThis.KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey as (event: globalThis.KeyboardEvent) => void);
    return () => document.removeEventListener('keydown', onKey as (event: globalThis.KeyboardEvent) => void);
  }, [mode, compact, close]);

  if (mode === 'closed') return null;
  if (mode === 'full') return <AssistantWorkspace />;
  // Phones and portrait tablets: compact and side are both a bottom sheet (side is taller), so nothing is ever cut off.
  if (compact) {
    const height = mode === 'side' ? '92dvh' : '85dvh';
    return (
      <Sheet open onOpenChange={(next) => { if (!next) close(); }} title={t('assistant.name')} hideTitle side="bottom" className={mode === 'side' ? 'h-[92dvh]' : 'h-[85dvh]'}>
        <div className="-mx-4 -mb-4" style={{ height: `calc(${height} - 3.5rem)` }}><AssistantPanel variant={mode} onClose={close} autoFocus={false} /></div>
      </Sheet>
    );
  }
  if (mode === 'compact') {
    return createPortal(
      <section role="dialog" aria-modal="false" aria-label={t('assistant.name')} style={{ right: 'calc(var(--shell-layout-switcher) + 0.75rem)' }}
        className="np-dialog fixed bottom-4 top-24 z-(--z-popover) w-[min(24rem,calc(100vw-6rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-overlay">
        <AssistantPanel variant="compact" onClose={close} />
      </section>,
      portalContainer() ?? document.body,
    );
  }
  return null; // 'side' on desktop is rendered by AssistantDock inside the layout
}

/** Dedicated workspace: conversation history on the left, the chat in the middle. Escape returns to the side panel. */
function AssistantWorkspace() {
  const { t } = useI18n();
  const { chat, setMode } = useAssistantUi();
  const compact = useIsCompactShell();
  const [listOpen, setListOpen] = useState(false);
  const { loadHistory } = chat;
  const phase = chat.state.phase;
  // Refresh the list when the workspace opens and whenever a reply finishes (titles and order change).
  useEffect(() => { if (phase === 'idle') void loadHistory(); }, [phase, loadHistory]);
  const currentId = chat.state.conversationId;

  const list = (
    <nav aria-label={t('assistant.history')} className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <h2 className="ui-label">{t('assistant.history')}</h2>
        <Button size="sm" variant="outline" onClick={() => { chat.startOver(); setListOpen(false); }}><Plus className="size-4" aria-hidden />{t('assistant.new')}</Button>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {chat.history.length === 0 ? <li className="px-2 text-xs text-text-muted">{t('assistant.history.empty')}</li> : chat.history.map((item) => (
          <li key={item.id}>
            <button type="button" aria-current={item.id === currentId ? 'true' : undefined} onClick={() => { void chat.openConversation(item.id); setListOpen(false); }}
              className={cn('flex w-full flex-col items-start rounded-lg px-2.5 py-2 text-left text-[13px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40', item.id === currentId ? 'bg-surface-active text-text' : 'text-text-secondary hover:bg-surface-hover')}>
              <span className="w-full truncate font-medium">{item.title ?? t('assistant.history.untitled')}</span>
              <span className="text-[11px] text-text-muted">{new Date(item.updatedAt).toLocaleString()}</span>
            </button>
          </li>))}
      </ul>
    </nav>
  );

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={t('assistant.name')} className="fixed inset-0 z-(--z-drawer) flex h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
      <header className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-2">
        {compact ? <IconButton label={t('assistant.history')} icon={<ListBullets />} size="icon-sm" onClick={() => setListOpen(true)} /> : null}
        <ChatCircleText className="size-5 text-text-muted" aria-hidden />
        <h1 className="min-w-0 flex-1 truncate font-display text-sm font-semibold text-text">{t('assistant.name')} · {t('assistant.mode.full')}</h1>
        <Button size="sm" variant="ghost" onClick={() => setMode('side')}>{t('assistant.mode.backToPanel')}</Button>
        <IconButton label={t('assistant.close')} icon={<X />} size="icon-sm" onClick={() => setMode('closed')} />
      </header>
      <div className="flex min-h-0 flex-1">
        {!compact ? <div className="hidden w-72 shrink-0 border-r border-border bg-surface md:block">{list}</div> : null}
        <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-3xl flex-1 flex-col"><AssistantPanel variant="full" /></div>
      </div>
      {compact ? <Sheet open={listOpen} onOpenChange={setListOpen} title={t('assistant.history')} side="left"><div className="-mx-4 h-[calc(100dvh-5rem)]">{list}</div></Sheet> : null}
    </div>,
    portalContainer() ?? document.body,
  );
}
