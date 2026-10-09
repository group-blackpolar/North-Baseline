import { useState } from 'react';
import { CloudSlash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Retryable "the API did not answer" screen. It is NOT an access decision: no sign-out, no "not found". */
export function ConnectionProblem({ onRetry, className }: { onRetry: () => Promise<unknown> | void; className?: string }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  return (
    <div className={cn('north-app-shell flex items-center justify-center bg-background p-6', className)} role="alert">
      <EmptyState
        icon={CloudSlash}
        title={t('conn.title')}
        body={t('conn.body')}
        className="w-full max-w-sm"
        action={
          <Button size="sm" disabled={busy} onClick={async () => { setBusy(true); try { await onRetry(); } finally { setBusy(false); } }}>
            {busy ? t('conn.retrying') : t('conn.retry')}
          </Button>
        }
      />
    </div>
  );
}
