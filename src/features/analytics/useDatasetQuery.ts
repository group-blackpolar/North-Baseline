import { useEffect, useMemo, useReducer, useRef } from 'react';
import { ApiError } from '@/lib/api';
import { queryDataset, type DatasetQueryRequest, type DatasetQueryResponse } from './datasetQuery';
import { datasetQueryToAnalyticsResult } from './datasetQueryAdapters';
import type { AnalyticsResult } from './types';

export type DatasetQueryState = {
  result: AnalyticsResult;
  response: DatasetQueryResponse | null;
  error: ApiError | null;
  reload: () => void;
};

function stableRequest(request: DatasetQueryRequest | null): string | null {
  return request === null ? null : JSON.stringify(request);
}

function requestError(reason: unknown): ApiError {
  return reason instanceof ApiError
    ? reason
    : new ApiError(0, reason instanceof Error ? reason.message : 'Dataset query failed');
}

/**
 * Runs a query only when both tenant and dataset are selected. It aborts an
 * in-flight request on input changes and uses a monotonically increasing
 * request id as a second guard against stale async responses.
 */
export function useDatasetQuery(
  organizationId: string | null | undefined,
  datasetId: string | null | undefined,
  request: DatasetQueryRequest | null,
): DatasetQueryState {
  const requestJson = useMemo(() => stableRequest(request), [request]);
  const requestRef = useRef(0);
  const [reloadVersion, incrementReloadVersion] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useReducer(
    (_: Omit<DatasetQueryState, 'reload'>, next: Omit<DatasetQueryState, 'reload'>) => next,
    { result: { state: 'empty' }, response: null, error: null },
  );

  useEffect(() => {
    const parsedRequest = requestJson === null ? null : JSON.parse(requestJson) as DatasetQueryRequest;
    if (!organizationId || !datasetId || !parsedRequest) {
      requestRef.current += 1;
      setState({ result: { state: 'empty' }, response: null, error: null });
      return;
    }

    const controller = new AbortController();
    const currentRequest = requestRef.current + 1;
    requestRef.current = currentRequest;
    setState({ result: { state: 'loading' }, response: null, error: null });

    void queryDataset(organizationId, datasetId, parsedRequest, controller.signal)
      .then((response) => {
        if (requestRef.current !== currentRequest) return;
        setState({ result: datasetQueryToAnalyticsResult(response), response, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || requestRef.current !== currentRequest) return;
        const error = requestError(reason);
        setState({ result: { state: 'error', message: error.message }, response: null, error });
      });

    return () => controller.abort();
  }, [datasetId, organizationId, reloadVersion, requestJson]);

  return { ...state, reload: incrementReloadVersion };
}
