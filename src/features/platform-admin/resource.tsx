import { useCallback, useEffect, useRef, useState, type DependencyList, type ReactNode } from 'react';
import { CircleAlert, RotateCw, ShieldAlert } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppErrorSafe } from '@/context/ErrorContext';
import { useI18n } from '@/lib/i18n';

export type FailureKind = 'unauthorized' | 'denied' | 'missing' | 'failed';

/** Maps an API failure to the fail-closed vocabulary used across the surface. */
export function failureKind(error: ApiError | null): FailureKind | null {
  if (!error) return null;
  if (error.status === 401) return 'unauthorized';
  if (error.status === 403) return 'denied';
  if (error.status === 404) return 'missing';
  return 'failed';
}

type ResourceStatus = 'loading' | 'ready' | 'failed';

export type ResourceState<T> = {
  status: ResourceStatus;
  data: T | null;
  error: ApiError | null;
  kind: FailureKind | null;
  reload: () => void;
};

/** Loads a remote resource with explicit states.
 *
 * On failure the previously loaded payload is dropped so protected data never
 * survives an authorization error on screen (§11: fail closed). A 401 is also
 * raised to the global session handler. `deps` are the caller's filters. */
export function useResource<T>(fetcher: () => Promise<T>, deps: DependencyList): ResourceState<T> {
  const appError = useAppErrorSafe();
  const [status, setStatus] = useState<ResourceStatus>('loading');
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    setStatus('loading');
    setError(null);
    fetcherRef
      .current()
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError(null);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        const apiError = reason instanceof ApiError ? reason : new ApiError(0, reason instanceof Error ? reason.message : 'Request failed');
        // A dead session must reach the global handler; protected payloads are dropped.
        if (apiError.status === 401) appError?.classifyAndRaise(apiError);
        setData(null);
        setError(apiError);
        setStatus('failed');
      });
    return () => {
      alive = false;
    };
    // The fetcher is intentionally read through a ref so callers can pass inline
    // closures while still controlling reloads through their own filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { status, data, error, kind: failureKind(error), reload };
}

/** Fail-closed message for any non-success state of a protected screen. */
export function ResourceFailure({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  const { t } = useI18n();
  const kind = failureKind(error);
  const denied = kind === 'denied' || kind === 'unauthorized';
  const icon = denied ? ShieldAlert : kind === 'missing' ? CircleAlert : RotateCw;
  const title = denied ? t('pa.state.deniedTitle') : kind === 'missing' ? t('pa.state.notFoundTitle') : t('pa.state.errorTitle');
  const body = denied
    ? t('pa.state.deniedBody')
    : kind === 'missing'
      ? t('pa.state.notFoundBody')
      : error.requestId
        ? `${error.message} (${error.requestId})`
        : error.message || t('pa.state.errorBody');
  const action: ReactNode =
    onRetry && kind === 'failed' ? (
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-hover"
      >
        <RotateCw className="h-3.5 w-3.5" />
        {t('pa.state.retry')}
      </button>
    ) : undefined;
  return <EmptyState icon={icon} title={title} body={body} action={action} />;
}

export type CursorListState<T> = {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  error: ApiError | null;
  kind: FailureKind | null;
  hasMore: boolean;
  reload: () => void;
  loadMore: () => void;
};

/** Cursor pagination for platform listings.
 *
 * The backend owns paging (`limit` + `nextCursor`); the client only appends the
 * next page and never re-fetches the whole collection to paginate locally. A
 * filter change resets the list. Failures drop the loaded rows. */
export function useCursorList<T>(
  fetcher: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>,
  deps: DependencyList
): CursorListState<T> {
  const appError = useAppErrorSafe();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const cursorRef = useRef<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let alive = true;
    cursorRef.current = null;
    setItems([]);
    setLoading(true);
    setError(null);
    fetcherRef
      .current(undefined)
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        cursorRef.current = page.nextCursor;
        setHasMore(Boolean(page.nextCursor));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!alive) return;
        const apiError = reason instanceof ApiError ? reason : new ApiError(0, reason instanceof Error ? reason.message : 'Request failed');
        if (apiError.status === 401) appError?.classifyAndRaise(apiError);
        setItems([]);
        setError(apiError);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const loadMore = useCallback(() => {
    const cursor = cursorRef.current;
    if (!cursor) return;
    setLoadingMore(true);
    fetcherRef
      .current(cursor)
      .then((page) => {
        setItems((current) => [...current, ...page.items]);
        cursorRef.current = page.nextCursor;
        setHasMore(Boolean(page.nextCursor));
        setLoadingMore(false);
      })
      .catch((reason: unknown) => {
        const apiError = reason instanceof ApiError ? reason : new ApiError(0, reason instanceof Error ? reason.message : 'Request failed');
        if (apiError.status === 401) appError?.classifyAndRaise(apiError);
        setError(apiError);
        setLoadingMore(false);
      });
  }, [appError]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { items, loading, loadingMore, error, kind: failureKind(error), hasMore, reload, loadMore };
}

