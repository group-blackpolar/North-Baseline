// Recoverable, NON-sensitive part of the sign-in/verification flow. A mobile browser may discard the page while the
// person reads the code in another app; this lets the form resume at the verification step. Passwords, one-time
// codes and tokens are never stored here. Framework-free so it can be unit-tested with `node --test`.

export type AuthFlowSnapshot = { mode: 'verification'; email: string; resendAt: number; expiresAt: number };

export interface FlowStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const KEY = 'north-auth-flow-v1';
/** A verification step older than this is discarded: CORECROW codes are short-lived and a stale step is misleading. */
export const AUTH_FLOW_TTL_MS = 30 * 60_000;

let memory: Record<string, string> = {};
const memoryStorage: FlowStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => { memory[key] = value; },
  removeItem: (key) => { delete memory[key]; },
};

function defaultStorage(): FlowStorage {
  // Desktop (Tauri) keeps the existing no-browser-storage rule for onboarding data: memory only.
  if (typeof window === 'undefined' || '__TAURI_INTERNALS__' in window) return memoryStorage;
  try { return window.sessionStorage; } catch { return memoryStorage; }
}

export function saveAuthFlow(input: { email: string; resendIn?: number }, now = Date.now(), storage: FlowStorage = defaultStorage()) {
  const snapshot: AuthFlowSnapshot = {
    mode: 'verification',
    email: input.email.trim().toLowerCase(),
    resendAt: now + Math.max(0, input.resendIn ?? 0) * 1000,
    expiresAt: now + AUTH_FLOW_TTL_MS,
  };
  try { storage.setItem(KEY, JSON.stringify(snapshot)); } catch { /* storage unavailable: the flow simply cannot be resumed */ }
}

export function loadAuthFlow(now = Date.now(), storage: FlowStorage = defaultStorage()): AuthFlowSnapshot | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<AuthFlowSnapshot>;
    const valid = value.mode === 'verification' && typeof value.email === 'string' && value.email.length > 0
      && typeof value.resendAt === 'number' && typeof value.expiresAt === 'number';
    if (!valid || (value.expiresAt as number) <= now) { storage.removeItem(KEY); return null; }
    return value as AuthFlowSnapshot;
  } catch {
    try { storage.removeItem(KEY); } catch { /* ignore */ }
    return null;
  }
}

export function clearAuthFlow(storage: FlowStorage = defaultStorage()) {
  try { storage.removeItem(KEY); } catch { /* ignore */ }
  memory = {};
}

/** Seconds left before "resend" is allowed again (never negative). */
export function resendSecondsLeft(snapshot: AuthFlowSnapshot, now = Date.now()) {
  return Math.max(0, Math.ceil((snapshot.resendAt - now) / 1000));
}
