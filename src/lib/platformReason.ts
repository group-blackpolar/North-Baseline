import { useSyncExternalStore } from 'react';

/**
 * ADR-0002 (option C): a platform operator writing to an organization they are not a member of must give a reason.
 * CORECROW answers 403 PLATFORM_REASON_REQUIRED; the client asks once, then sends `X-Platform-Reason` on later writes.
 * The reason lives in memory only (one tab, until reload). CORECROW still validates and audits every use.
 */
export const REASON_REQUIRED_CODE = 'PLATFORM_REASON_REQUIRED';
export const MIN_REASON_LENGTH = 10;

let reason: string | null = null;
let pending: { resolve: (value: string | null) => void } | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

export const getReason = () => reason;

/** Resolves with the reason the operator typed, or null when they cancel. Concurrent callers share one prompt. */
let asking: Promise<string | null> | null = null;
export function askReason(): Promise<string | null> {
  if (reason) return Promise.resolve(reason);
  asking ??= new Promise<string | null>((resolve) => {
    pending = { resolve };
    emit();
  }).finally(() => { asking = null; });
  return asking;
}

export function answerReason(value: string | null) {
  const trimmed = value?.trim() ?? '';
  reason = trimmed.length >= MIN_REASON_LENGTH ? trimmed : null;
  const current = pending;
  pending = null;
  emit();
  current?.resolve(reason);
}

export function usePendingReason() {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => pending,
  );
}

export const reasonHeaders = (): Record<string, string> => (reason ? { 'X-Platform-Reason': reason } : {});
