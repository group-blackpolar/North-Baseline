// Autosave state machine for an exam attempt (pure, unit-tested). The server is authoritative: PostgreSQL holds the answers and ignores a
// write whose `seq` is not newer than the stored one. This class only decides WHAT to send and how to reconcile what comes back, so a
// reload, a second tab or a flaky connection never loses or reverts an answer.

export interface Saved { questionId: string; optionId: string | null; seq: number }
export interface SaveResponse { status: 'IN_PROGRESS' | 'EXPIRED'; applied: string[]; ignored: string[]; answers: Saved[] }
export type SyncState = 'saved' | 'pending' | 'saving' | 'offline';

export class AnswerSync {
  private answers = new Map<string, Saved>();
  private dirty = new Set<string>();
  private inFlight = new Map<string, Saved>();
  private highest = 0;
  private failures = 0;

  constructor(initial: readonly Saved[] = []) {
    for (const answer of initial) { this.answers.set(answer.questionId, answer); this.highest = Math.max(this.highest, answer.seq); }
  }

  /** The person picks (or clears) an option. Returns the new local seq. */
  choose(questionId: string, optionId: string | null): number {
    this.highest += 1;
    this.answers.set(questionId, { questionId, optionId, seq: this.highest });
    this.dirty.add(questionId);
    return this.highest;
  }

  selected(questionId: string): string | null { return this.answers.get(questionId)?.optionId ?? null; }
  answeredCount(): number { let count = 0; for (const answer of this.answers.values()) if (answer.optionId) count += 1; return count; }
  isAnswered(questionId: string) { return Boolean(this.answers.get(questionId)?.optionId); }

  /** The batch to send now (at most one in flight at a time per question; later choices wait for the next batch). */
  nextBatch(limit = 50): Saved[] {
    const batch: Saved[] = [];
    for (const questionId of this.dirty) {
      if (batch.length >= limit) break;
      if (this.inFlight.has(questionId)) continue;
      const answer = this.answers.get(questionId)!;
      this.inFlight.set(questionId, answer);
      batch.push(answer);
    }
    for (const answer of batch) this.dirty.delete(answer.questionId);
    return batch;
  }

  /** The server answered. Anything it holds with a seq at least as new as ours wins (another tab or device wrote later). */
  acknowledge(batch: readonly Saved[], response: SaveResponse): { adopted: string[] } {
    this.failures = 0;
    for (const sent of batch) if (this.inFlight.get(sent.questionId) === sent) this.inFlight.delete(sent.questionId);
    const adopted: string[] = [];
    for (const server of response.answers) {
      const local = this.answers.get(server.questionId);
      const edited = this.dirty.has(server.questionId) || this.inFlight.has(server.questionId);
      if (edited && local && local.seq > server.seq) continue; // a newer local choice is already queued
      if (!local || server.seq > local.seq || (server.seq === local.seq && server.optionId !== local.optionId)) {
        this.answers.set(server.questionId, server);
        this.highest = Math.max(this.highest, server.seq);
        if (local && local.optionId !== server.optionId) adopted.push(server.questionId);
      }
    }
    return { adopted };
  }

  /** The request failed (network, 5xx): requeue it unchanged, the same seq makes a late retry harmless. */
  failed(batch: readonly Saved[]) {
    this.failures += 1;
    for (const sent of batch) {
      this.inFlight.delete(sent.questionId);
      const current = this.answers.get(sent.questionId);
      if (current) this.dirty.add(sent.questionId);
    }
  }

  get state(): SyncState {
    if (this.failures > 0) return 'offline';
    if (this.inFlight.size > 0) return 'saving';
    return this.dirty.size > 0 ? 'pending' : 'saved';
  }
  get hasUnsaved() { return this.dirty.size > 0 || this.inFlight.size > 0; }
  /** Delay before the next retry: 1 s doubling to 30 s. */
  retryDelayMs() { return Math.min(30_000, 1_000 * 2 ** Math.max(0, this.failures - 1)); }
}

/** Seconds left from the deadline and the server's clock, immune to the client's clock being wrong. */
export function remainingSeconds(input: { deadlineAt: string | null; serverTime: string; clientTimeAtLoad: number; clientNow: number }): number | null {
  if (!input.deadlineAt) return null;
  const serverNow = Date.parse(input.serverTime) + (input.clientNow - input.clientTimeAtLoad);
  return Math.max(0, Math.ceil((Date.parse(input.deadlineAt) - serverNow) / 1000));
}

export type Tone = 'current' | 'answered' | 'pending';
/** Navigator model: one entry per question, in order. */
export function navigatorItems(questionIds: readonly string[], currentIndex: number, isAnswered: (id: string) => boolean): Array<{ id: string; number: number; tone: Tone }> {
  return questionIds.map((id, index) => ({ id, number: index + 1, tone: index === currentIndex ? 'current' : isAnswered(id) ? 'answered' : 'pending' }));
}
