import { useEffect, useState } from 'react';
import { WarningCircle } from '@phosphor-icons/react';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { DocumentStatus, Localized } from './api';

export function errorText(error: unknown) {
  if (error instanceof ApiError) return `${error.message}${error.requestId ? ` (${error.requestId})` : ''}`;
  return error instanceof Error ? error.message : 'Request failed';
}

export const localizedLabel = (names: Localized | undefined, locale: string) => (names ? (names[locale] ?? names.es ?? names.en ?? Object.values(names)[0] ?? '') : '');

export const formatDate = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
export const formatDateTime = (iso: string, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
export const toDateInput = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const TONE: Record<DocumentStatus, string> = {
  DRAFT: 'border-border bg-surface-hover text-text-secondary',
  READY: 'border-accent/30 bg-accent-soft text-accent',
  SENT: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  COMPLETED: 'border-success/30 bg-success/10 text-success',
  CANCELLED: 'border-error/30 bg-error/10 text-error',
};

export function StatusBadge({ status, label }: { status: DocumentStatus; label: string }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium', TONE[status])}>{label}</span>;
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="flex items-start gap-1.5 text-xs text-error"><WarningCircle className="mt-px size-3.5 shrink-0" />{message}</p>;
}

/** Loads an authenticated image into an object URL and releases it on unmount. */
export function useBlobUrl(load: () => Promise<Blob>, key: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    let created: string | null = null;
    setUrl(null); setFailed(false);
    void load().then((blob) => { if (!live) return; created = URL.createObjectURL(blob); setUrl(created); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; if (created) URL.revokeObjectURL(created); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { url, failed };
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const selectClass = 'h-9 rounded-md border border-border bg-surface px-2 text-sm text-text outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50';
export const fieldLabel = 'ui-label';
