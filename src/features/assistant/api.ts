import { API_BASE, ApiError, apiRequest } from '@/lib/api';
import { authHeaders } from '@/lib/auth';
import { isTerminal, reconnectDelay, SseParser, type SseEvent } from './protocol.ts';

export interface ConversationSummary { id: string; title: string | null; updatedAt: string }
export interface StoredMessage { id: string; role: 'USER' | 'ASSISTANT' | 'TOOL'; content: string }

const post = <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });

/** Conversations are always created and read inside the active organization; CORECROW re-authorizes membership on every call. */
export const createConversation = (organizationId: string) =>
  post<ConversationSummary>('/v1/ai/conversations', { organizationId, application: 'north' });

export const listConversations = (organizationId: string) =>
  apiRequest<ConversationSummary[]>(`/v1/ai/conversations?organizationId=${encodeURIComponent(organizationId)}`);

export const readConversation = (organizationId: string, conversationId: string) =>
  apiRequest<ConversationSummary & { messages: StoredMessage[] }>(`/v1/ai/conversations/${encodeURIComponent(conversationId)}?organizationId=${encodeURIComponent(organizationId)}`);

export const createRun = (organizationId: string, conversationId: string, message: string) =>
  post<{ runId: string }>('/v1/ai/runs', { organizationId, conversationId, application: 'north', message });

export const cancelRun = (organizationId: string, runId: string) =>
  post<unknown>(`/v1/ai/runs/${encodeURIComponent(runId)}/cancel`, { organizationId });

const sleep = (ms: number, signal: AbortSignal) => new Promise<void>((resolve) => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true });
});

/**
 * Reads the persisted event stream of one run with `fetch` (so the desktop bearer works, which EventSource cannot send).
 * A dropped connection resumes from the last applied sequence (`after` + `Last-Event-ID`); the server replays terminal runs.
 * Resolves when a terminal event was delivered or the signal aborted; throws ApiError for a refusal or when the stream is lost.
 */
export async function streamRun(options: { organizationId: string; runId: string; signal: AbortSignal; onEvent: (event: SseEvent) => void }): Promise<void> {
  const { organizationId, runId, signal, onEvent } = options;
  let after = 0;
  for (let attempt = 0; ; attempt++) {
    if (signal.aborted) return;
    try {
      const response = await fetch(`${API_BASE}/v1/ai/runs/${encodeURIComponent(runId)}/events?organizationId=${encodeURIComponent(organizationId)}&after=${after}`, {
        credentials: 'include', signal,
        headers: { Accept: 'text/event-stream', 'Last-Event-ID': String(after), ...authHeaders() },
      });
      if (!response.ok || !response.body) {
        let code: string | undefined;
        try { code = (await response.json())?.error?.code; } catch { /* no JSON body */ }
        const error = new ApiError(response.status, response.statusText, code);
        if (response.status < 500 && response.status !== 408) throw error; // a refusal is final; 5xx may recover
        throw Object.assign(error, { retryable: true });
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const parser = new SseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          if (event.id !== null) after = Math.max(after, event.id);
          onEvent(event);
          if (isTerminal(event)) { void reader.cancel().catch(() => undefined); return; }
        }
      }
      // The server closed without a terminal event: fall through to a resume.
    } catch (error) {
      if (signal.aborted) return;
      if (error instanceof ApiError && !(error as { retryable?: boolean }).retryable) throw error;
    }
    const delay = reconnectDelay(attempt);
    if (delay === null) throw new ApiError(0, 'stream lost', 'AI_STREAM_LOST');
    await sleep(delay, signal);
  }
}
