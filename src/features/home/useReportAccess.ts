import { useEffect, useState } from 'react';
import { getReportAccess } from './reportAccessApi';
import type { AccessLookup } from './cardState';

/** One authorized request answers every card. A failed lookup is `error` (never read as access) and can be retried. */
export function useReportAccess(organizationId: string | undefined, slugs: string[]) {
  const [access, setAccess] = useState<AccessLookup>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const key = slugs.join(',');
  useEffect(() => {
    if (!organizationId || !key) return;
    const controller = new AbortController();
    setAccess({ status: 'loading' });
    getReportAccess(organizationId, key.split(','), controller.signal)
      .then((rows) => setAccess({ status: 'ready', rows: new Map(rows.map((row) => [row.slug, row])) }))
      .catch(() => { if (!controller.signal.aborted) setAccess({ status: 'error' }); });
    return () => controller.abort();
  }, [organizationId, key, attempt]);
  return { access, retry: () => setAttempt((value) => value + 1) };
}
