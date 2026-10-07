import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { ErrorState } from '@/components/ui/error-state';
import { DelayedSkeleton, SkeletonAdminCard, SkeletonTable } from '@/components/ui/skeleton';
import { useShellMode } from '@/lib/responsive';
import { ApiError } from '@/lib/api';
import type { Member } from './api';

/** Loads a list once per organization and exposes explicit reload. Failures keep the real CORECROW message. */
export function useList<T>(load: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({ data: null, error: null, loading: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(async () => {
    try { setState({ data: await run(), error: null, loading: false }); }
    catch (error) { setState((current) => ({ ...current, loading: false, error: errorText(error) })); }
  }, [run]);
  useEffect(() => { setState({ data: null, error: null, loading: true }); void reload(); }, [reload]);
  return { ...state, reload };
}

export function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.message}${error.requestId ? ` (${error.requestId})` : ''}`;
  return error instanceof Error ? error.message : 'Request failed';
}

export function Notice({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (error) return <p role="alert" className="flex items-start gap-1.5 text-xs text-error"><WarningCircle className="mt-px size-3.5 shrink-0" />{error}</p>;
  if (ok) return <p role="status" className="text-xs text-success">{ok}</p>;
  return null;
}

export function Shell({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <div className="north-enter mx-auto w-full max-w-[1680px] space-y-4 p-4 lg:p-5">
      <header><h1 className="font-display text-xl font-semibold text-text">{title}</h1><p className="mt-0.5 text-xs text-text-secondary">{hint}</p></header>
      {children}
    </div>
  );
}

/** Delayed, real-shape placeholder: cards on phone, table rows elsewhere; empty box of similar height during the delay. */
export function Loading() {
  const phone = useShellMode() === 'phone';
  return <DelayedSkeleton loading minHeight={200} fallback={phone ? <div className="space-y-2">{[0, 1, 2].map((i) => <SkeletonAdminCard key={i} lines={2} />)}</div> : <SkeletonTable rows={4} columns={4} />} />;
}

/** A list that failed to load and has nothing to show: block with Retry. (With data still on screen the Notice above is enough.) */
export function LoadError({ list }: { list: { error: string | null; data: unknown; loading: boolean; reload: () => unknown } }) {
  return list.error && !list.data && !list.loading ? <ErrorState message={list.error} onRetry={() => void list.reload()} /> : null;
}

export const selectClass = 'h-8 pointer-coarse:h-(--touch-min) rounded-md border border-border bg-surface px-2 text-base md:text-xs text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50';
export const th = 'border-b border-border px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-text-muted';
export const td = 'border-b border-border/60 px-3 py-2 text-xs text-text';
export const memberLabel = (member: Member) => member.name?.trim() || member.email || member.userId;

export function useBusy() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const act = async (key: string, work: () => Promise<unknown>, success?: string) => {
    setBusy(key); setError(null); setOk(null);
    try { await work(); if (success) setOk(success); return true; }
    catch (reason) { setError(errorText(reason)); return false; }
    finally { setBusy(null); }
  };
  return { busy, error, ok, act, setError };
}

