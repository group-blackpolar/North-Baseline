import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { ArrowUp, CheckCircle, CircleNotch, Plus, Stop, WarningCircle, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n, type Dictionary } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { RavenIcon } from './RavenIcon';
import { errorKind, type ChatMessage, type ToolStep } from './protocol.ts';
import { parseBlocks, type Inline } from './richText.ts';
import { useAssistant } from './useAssistant';

const MAX_CHARS = 8_000;
const SUGGESTIONS = ['assistant.suggest.permissions', 'assistant.suggest.photo', 'assistant.suggest.split'] as const;
const TOOL_TOPIC: Record<string, keyof Dictionary> = {
  'user.permissions': 'assistant.what.permissions',
  'organization.current': 'assistant.what.organization',
  'organization.members.list': 'assistant.what.members',
  'user.me': 'assistant.what.profile',
};

function Inlines({ items }: { items: Inline[] }) {
  return <>{items.map((item, i) => (item.kind === 'bold' ? <strong key={i} className="font-semibold">{item.value}</strong> : item.kind === 'code' ? <code key={i} className="rounded bg-surface-active px-1 py-0.5 font-mono text-[12px]">{item.value}</code> : <span key={i}>{item.value}</span>))}</>;
}

/** Reply text rendered from a parsed structure (never as HTML), so model output cannot inject markup, links or images. */
function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {parseBlocks(text).map((block, i) => block.kind === 'p'
        ? <p key={i} className="whitespace-pre-wrap break-words"><Inlines items={block.inlines} /></p>
        : block.kind === 'ul'
          ? <ul key={i} className="list-disc space-y-1 pl-5">{block.items.map((item, j) => <li key={j}><Inlines items={item} /></li>)}</ul>
          : <ol key={i} className="list-decimal space-y-1 pl-5">{block.items.map((item, j) => <li key={j}><Inlines items={item} /></li>)}</ol>)}
    </div>
  );
}

function ToolLine({ step }: { step: ToolStep }) {
  const { t } = useI18n();
  const what = t(TOOL_TOPIC[step.name] ?? 'assistant.what.generic');
  const key = step.status === 'running' ? 'assistant.tool.running' : step.status === 'done' ? 'assistant.tool.done' : 'assistant.tool.failed';
  return (
    <li className="flex items-center gap-1.5 text-[12px] text-text-muted">
      {step.status === 'running' ? <CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : step.status === 'done' ? <CheckCircle className="size-3.5 text-success" aria-hidden="true" /> : <WarningCircle className="size-3.5 text-warning" aria-hidden="true" />}
      {t(key, { what })}
    </li>
  );
}

function Bubble({ message, tools, thinking }: { message: ChatMessage; tools: ToolStep[]; thinking: boolean }) {
  const { t } = useI18n();
  const mine = message.role === 'user';
  return (
    <div className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <span className="sr-only">{mine ? t('assistant.you') : t('assistant.name')}</span>
      {!mine && message.pending && tools.length > 0 && <ul className="space-y-0.5 px-1">{tools.map((step) => <ToolLine key={step.id} step={step} />)}</ul>}
      {(message.text || (message.pending && thinking)) && (
        <div className={cn('max-w-[92%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed', mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-surface-hover text-text')}>
          {message.text ? (mine ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : <RichText text={message.text} />) : <span className="flex items-center gap-1.5 text-text-muted"><CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t('assistant.thinking')}</span>}
        </div>
      )}
      {message.stopped && <p className="px-1 text-[11px] text-text-muted">{t('assistant.stopped')}</p>}
    </div>
  );
}

/** The Cuervo chat. It is mounted inside the keyed organization subtree, so a tenant switch discards everything. */
export function AssistantPanel({ organizationId, onClose, autoFocus = true }: { organizationId: string; onClose?: () => void; autoFocus?: boolean }) {
  const { t } = useI18n();
  const { state, loading, loadError, load, send, cancel, startOver } = useAssistant(organizationId);
  const [draft, setDraft] = useState('');
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const lastSent = useRef('');
  const busy = state.phase !== 'idle';

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (autoFocus) field.current?.focus(); }, [autoFocus]);
  useEffect(() => {
    const element = log.current;
    if (!element) return;
    const nearBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    if (nearBottom || state.phase === 'sending') element.scrollTo({ top: element.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state.messages, state.tools, state.phase]);
  useEffect(() => { // grow with the text, up to five lines
    const element = field.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  }, [draft]);

  const submit = (text = draft) => {
    const value = text.trim();
    if (!value || busy || value.length > MAX_CHARS) return;
    lastSent.current = value;
    setDraft('');
    void send(value);
  };
  const onSubmit = (event: FormEvent) => { event.preventDefault(); submit(); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); submit(); }
  };

  const failure = state.error ?? loadError;
  const empty = state.messages.length === 0 && !loading;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-surface-active text-text"><RavenIcon size={20} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold leading-tight text-text">{t('assistant.name')}</h2>
          <p className="text-[11px] leading-tight text-text-muted">{t('assistant.subtitle')}</p>
        </div>
        <IconButton label={t('assistant.new')} icon={<Plus />} size="icon-sm" disabled={busy || empty} onClick={() => { startOver(); setDraft(''); field.current?.focus(); }} />
        {onClose && <IconButton label={t('assistant.close')} icon={<X />} size="icon-sm" onClick={onClose} />}
      </header>

      <div ref={log} role="log" aria-live="polite" aria-relevant="additions text" aria-label={t('assistant.name')} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {loading && <p className="flex items-center gap-2 text-[12px] text-text-muted"><CircleNotch className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />{t('assistant.loading')}</p>}
        {empty && (
          <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-surface-active text-text"><RavenIcon size={30} /></span>
            <div>
              <p className="font-display text-[15px] font-semibold text-text">{t('assistant.empty.title')}</p>
              <p className="mt-1 text-[13px] text-text-secondary">{t('assistant.empty.body')}</p>
            </div>
            <div className="flex w-full flex-col gap-1.5">
              {SUGGESTIONS.map((key) => (
                <button key={key} type="button" onClick={() => submit(t(key))} className="rounded-xl border border-border bg-surface px-3 py-2 text-left text-[13px] text-text-secondary outline-none transition-colors duration-(--duration-fast) hover:border-border-hover hover:bg-surface-hover hover:text-text focus-visible:ring-2 focus-visible:ring-accent/40">{t(key)}</button>
              ))}
            </div>
          </div>
        )}
        {state.messages.map((message, index) => (
          <Bubble key={message.id} message={message} tools={state.tools} thinking={state.phase !== 'idle' && index === state.messages.length - 1} />
        ))}
        {failure && (
          <div role="alert" className="flex items-start gap-2 rounded-xl border border-border bg-surface p-3 text-[13px] text-text-secondary">
            <WarningCircle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p>{t(`assistant.error.${errorKind(failure)}` as keyof Dictionary)}</p>
              {errorKind(failure) !== 'unavailable' && errorKind(failure) !== 'forbidden' && (
                <Button size="sm" variant="secondary" className="mt-2" disabled={busy} onClick={() => (state.error && lastSent.current ? submit(lastSent.current) : void load())}>{t('assistant.retry')}</Button>
              )}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-border p-3">
        <div className="flex items-end gap-2 rounded-xl border border-border bg-background px-2.5 py-2 focus-within:border-border-selected">
          <textarea
            ref={field} rows={1} value={draft} maxLength={MAX_CHARS + 200}
            onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown}
            placeholder={t('assistant.placeholder')} aria-label={t('assistant.placeholder')}
            className="max-h-[120px] min-h-6 flex-1 resize-none bg-transparent text-[13px] leading-6 text-text outline-none placeholder:text-text-muted"
          />
          {busy ? (
            <IconButton label={t('assistant.stop')} icon={<Stop weight="fill" />} size="icon-sm" variant="secondary" disabled={!state.runId || state.phase === 'cancelling'} onClick={() => void cancel()} />
          ) : (
            <IconButton label={t('assistant.send')} icon={<ArrowUp weight="bold" />} size="icon-sm" variant="accent" type="submit" disabled={!draft.trim() || draft.length > MAX_CHARS} />
          )}
        </div>
        {draft.length > MAX_CHARS - 1_000 && <p role="status" className={cn('mt-1 text-[11px]', draft.length > MAX_CHARS ? 'text-error' : 'text-text-muted')}>{t('assistant.remaining', { n: MAX_CHARS - draft.length })}</p>}
        <p className="mt-2 text-center text-[11px] leading-snug text-text-muted">{t('assistant.scope')}</p>
      </form>
    </div>
  );
}
