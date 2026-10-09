// Pure protocol + state of the NORTH assistant (Cuervo). No React and no `@/` imports: unit-tested with `node --test`.
// It consumes only the CORECROW `/v1/ai/*` contract: persisted SSE events with a numeric `id`, replayable with `after`.

export interface SseEvent { id: number | null; type: string; data: unknown }

const NEWLINE = String.fromCharCode(10);
const RETURN = String.fromCharCode(13);

/** Incremental Server-Sent Events parser: tolerates split chunks, CRLF, comments (heartbeats) and unknown fields. */
export class SseParser {
  private buffer = '';
  private id: number | null = null;
  private type = 'message';
  private data: string[] = [];

  push(chunk: string): SseEvent[] {
    this.buffer += chunk;
    const events: SseEvent[] = [];
    let index: number;
    while ((index = this.buffer.indexOf(NEWLINE)) >= 0) {
      let line = this.buffer.slice(0, index);
      this.buffer = this.buffer.slice(index + 1);
      if (line.endsWith(RETURN)) line = line.slice(0, -1);
      if (line === '') {
        if (this.data.length) events.push({ id: this.id, type: this.type, data: parseData(this.data.join(NEWLINE)) });
        this.type = 'message'; this.data = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
      if (field === 'id') { const n = Number(value); this.id = Number.isInteger(n) && n >= 0 ? n : this.id; }
      else if (field === 'event') this.type = value || 'message';
      else if (field === 'data') this.data.push(value);
    }
    return events;
  }
}

function parseData(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

export const TERMINAL_EVENTS = new Set(['run.completed', 'run.failed', 'run.cancelled']);
export const isTerminal = (event: SseEvent) => TERMINAL_EVENTS.has(event.type);

// ─── Chat state ──────────────────────────────────────────────────────────────────────────────────────────────
export type Phase = 'idle' | 'sending' | 'streaming' | 'cancelling';
export interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; pending?: boolean; stopped?: boolean }
export interface ToolStep { id: string; name: string; status: 'running' | 'done' | 'failed' }
export interface ChatState {
  conversationId: string | null;
  runId: string | null;
  phase: Phase;
  messages: ChatMessage[];
  tools: ToolStep[];
  lastSequence: number;
  /** Normalized error code of the last failed operation, for the UI to translate. */
  error: string | null;
}

export const initialChatState: ChatState = { conversationId: null, runId: null, phase: 'idle', messages: [], tools: [], lastSequence: 0, error: null };

export type ChatAction =
  | { type: 'reset' }
  | { type: 'loaded'; conversationId: string; messages: Array<{ id: string; role: 'USER' | 'ASSISTANT' | 'TOOL'; content: string }> }
  | { type: 'sending'; localId: string; text: string; conversationId?: string }
  | { type: 'conversation'; conversationId: string }
  | { type: 'run.created'; runId: string }
  | { type: 'event'; event: SseEvent }
  | { type: 'failed'; code: string }
  | { type: 'cancelling' };

const text = (value: unknown) => (value && typeof value === 'object' && typeof (value as { text?: unknown }).text === 'string' ? (value as { text: string }).text : '');
const field = (value: unknown, key: string) => (value && typeof value === 'object' && typeof (value as Record<string, unknown>)[key] === 'string' ? ((value as Record<string, string>)[key]) : '');

function finishPending(messages: ChatMessage[], patch: Partial<ChatMessage> = {}): ChatMessage[] {
  return messages.flatMap((message) => {
    if (!message.pending) return [message];
    if (!message.text && !patch.stopped) return []; // nothing was produced: drop the empty placeholder
    return [{ ...message, pending: false, ...patch }];
  });
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'reset':
      return initialChatState;
    case 'loaded':
      return {
        ...initialChatState,
        conversationId: action.conversationId,
        // Stored TOOL rows are internal; only the human conversation is shown.
        messages: action.messages.filter((m) => m.role !== 'TOOL').map((m) => ({ id: m.id, role: m.role === 'USER' ? 'user' : 'assistant', text: m.content })),
      };
    case 'sending':
      return {
        ...state, conversationId: action.conversationId ?? state.conversationId, runId: null, phase: 'sending', tools: [], lastSequence: 0, error: null,
        messages: [...finishPending(state.messages), { id: action.localId, role: 'user', text: action.text }, { id: `${action.localId}-reply`, role: 'assistant', text: '', pending: true }],
      };
    case 'conversation':
      return { ...state, conversationId: action.conversationId };
    case 'run.created':
      return { ...state, runId: action.runId, phase: 'streaming' };
    case 'cancelling':
      return state.phase === 'streaming' || state.phase === 'sending' ? { ...state, phase: 'cancelling' } : state;
    case 'failed':
      return { ...state, phase: 'idle', runId: null, error: action.code, messages: finishPending(state.messages) };
    case 'event': {
      const { event } = action;
      // A reconnect replays from `after`; anything already applied is ignored.
      if (event.id !== null && event.id <= state.lastSequence) return state;
      const next: ChatState = { ...state, lastSequence: event.id ?? state.lastSequence };
      switch (event.type) {
        case 'message.delta':
          return { ...next, messages: next.messages.map((m) => (m.pending ? { ...m, text: m.text + text(event.data) } : m)) };
        case 'message.completed':
          // The completed text is authoritative: earlier deltas may include text spoken before a tool call.
          return { ...next, messages: next.messages.map((m) => (m.pending ? { ...m, text: text(event.data) || m.text, pending: false } : m)) };
        case 'tool.proposed': case 'tool.started':
          return { ...next, tools: upsertTool(next.tools, field(event.data, 'toolCallId'), field(event.data, 'name'), 'running') };
        case 'tool.completed':
          return { ...next, tools: upsertTool(next.tools, field(event.data, 'toolCallId'), field(event.data, 'name'), 'done') };
        case 'tool.failed':
          return { ...next, tools: upsertTool(next.tools, field(event.data, 'toolCallId'), field(event.data, 'name'), 'failed') };
        case 'run.completed':
          return { ...next, phase: 'idle', runId: null, messages: finishPending(next.messages) };
        case 'run.cancelled':
          return { ...next, phase: 'idle', runId: null, messages: finishPending(next.messages, { stopped: true }) };
        case 'run.failed':
          return { ...next, phase: 'idle', runId: null, error: field(event.data, 'code') || 'AI_RUN_FAILED', messages: finishPending(next.messages) };
        default:
          return next; // run.started and unknown future events
      }
    }
  }
}

function upsertTool(tools: ToolStep[], id: string, name: string, status: ToolStep['status']): ToolStep[] {
  const key = id || name;
  return tools.some((t) => t.id === key) ? tools.map((t) => (t.id === key ? { ...t, status } : t)) : [...tools, { id: key, name, status }];
}

/** Maps a normalized CORECROW error code (or HTTP status) to a translation key suffix. */
export function errorKind(code: string | null | undefined, status?: number): 'unavailable' | 'rateLimited' | 'busy' | 'timeout' | 'forbidden' | 'tooLong' | 'generic' {
  if (code === 'AI_DISABLED' || code === 'AI_PROVIDER_NOT_CONFIGURED' || code === 'AI_PROVIDER_AUTHENTICATION_FAILED' || code === 'AI_MODEL_UNAVAILABLE') return 'unavailable';
  if (code === 'AI_PROVIDER_RATE_LIMITED' || code === 'AI_RATE_LIMITED' || code === 'RATE_LIMITED' || status === 429) return 'rateLimited';
  if (code === 'AI_CONCURRENCY_LIMITED') return 'busy';
  if (code === 'AI_PROVIDER_TIMEOUT' || code === 'AI_RUN_TIMEOUT') return 'timeout';
  if (code === 'AI_PERMISSION_DENIED' || status === 403) return 'forbidden';
  if (code === 'AI_MESSAGE_TOO_LONG') return 'tooLong';
  return 'generic';
}

/** Reconnect policy for a dropped stream: bounded exponential backoff, no more than `max` attempts. */
export function reconnectDelay(attempt: number, max = 5): number | null {
  return attempt >= max ? null : Math.min(8_000, 500 * 2 ** attempt);
}
