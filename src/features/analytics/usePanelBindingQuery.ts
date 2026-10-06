import { useEffect, useMemo, useReducer, useRef } from 'react';
import { ApiError } from '@/lib/api';
import type { DatasetQueryFilter } from './datasetQuery';
import { datasetQueryToAnalyticsResult } from './datasetQueryAdapters';
import { queryPanelAnalyticsBinding, type PanelBindingQueryResult } from './panelBindingQuery';
import { useShowcaseSlug } from '@/features/showcase/ShowcaseContext';
import { queryShowcaseBinding } from '@/lib/showcase';
import type { AnalyticsResult } from './types';

export type PanelBindingQueryState = {
  result: AnalyticsResult;
  response: PanelBindingQueryResult | null;
  error: ApiError | null;
  reload: () => void;
};

function requestError(reason: unknown): ApiError {
  return reason instanceof ApiError
    ? reason
    : new ApiError(0, reason instanceof Error ? reason.message : 'Analytics binding query failed');
}

/**
 * Published-binding equivalent of useDatasetQuery. It intentionally has a
 * separate client: callers cannot provide a dataset ID or a query definition.
 */
export function usePanelBindingQuery(
  organizationId: string | null | undefined,
  panelId: string | null | undefined,
  bindingId: string | null | undefined,
  filters: DatasetQueryFilter[] = [],
): PanelBindingQueryState {
  // Inside the anonymous showcase the same typed result contract comes from the public endpoint.
  const showcaseSlug = useShowcaseSlug();
  const filtersJson = useMemo(() => JSON.stringify(filters), [filters]);
  const requestRef = useRef(0);
  const [reloadVersion, incrementReloadVersion] = useReducer((value: number) => value + 1, 0);
  const [state, setState] = useReducer(
    (_: Omit<PanelBindingQueryState, 'reload'>, next: Omit<PanelBindingQueryState, 'reload'>) => next,
    { result: { state: 'empty' }, response: null, error: null },
  );

  useEffect(() => {
    const parsedFilters = JSON.parse(filtersJson) as DatasetQueryFilter[];
    if (!organizationId || !panelId || !bindingId) {
      requestRef.current += 1;
      setState({ result: { state: 'empty' }, response: null, error: null });
      return;
    }

    const controller = new AbortController();
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setState({ result: { state: 'loading' }, response: null, error: null });

    const request = showcaseSlug
      ? queryShowcaseBinding(showcaseSlug, panelId, bindingId, parsedFilters, controller.signal)
      : queryPanelAnalyticsBinding(organizationId, panelId, bindingId, parsedFilters, controller.signal);
    void request
      .then((response) => {
        if (requestRef.current !== requestId) return;
        setState({ result: datasetQueryToAnalyticsResult(response), response, error: null });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        const error = requestError(reason);
        setState({ result: { state: 'error', message: error.message }, response: null, error });
      });

    return () => controller.abort();
  }, [bindingId, filtersJson, organizationId, panelId, reloadVersion, showcaseSlug]);

  return { ...state, reload: incrementReloadVersion };
}
