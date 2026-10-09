import { useState } from 'react';
import { Lock } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface SessionLockOverlayProps {
  /** inactivity: the session may still be alive (Resume re-checks it). expired: CORECROW says it is gone. */
  reason: 'inactivity' | 'expired';
  onResume: () => Promise<boolean>;
  onLogout: () => void;
}

export function SessionLockOverlay({ reason, onResume, onLogout }: SessionLockOverlayProps) {
  const { t } = useI18n();
  const [resuming, setResuming] = useState(false);
  const [failed, setFailed] = useState(false);
  const expired = reason === 'expired';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-background/60 backdrop-blur-md p-4"
    >
      <div className="np-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="mx-auto size-11 rounded-xl bg-surface-active flex items-center justify-center">
          <Lock className="w-5 h-5 text-text-secondary" />
        </div>
        <div className="space-y-1">
          <h1 id="session-lock-title" className="font-display text-lg font-semibold text-text">
            {expired ? t('error.SESSION_EXPIRED.title') : t('session.locked.title')}
          </h1>
          <p className="text-sm text-text-secondary">{expired ? t('error.SESSION_EXPIRED.body') : t('session.locked.body')}</p>
          {failed && <p role="alert" className="text-xs text-error">{t('conn.body')}</p>}
        </div>
        <div className="flex flex-col gap-2 pt-1">
          {!expired && (
            <Button
              variant="primary"
              disabled={resuming}
              onClick={async () => {
                setResuming(true);
                setFailed(false);
                const ok = await onResume();
                setResuming(false);
                if (!ok) setFailed(true);
              }}
            >
              {resuming ? t('session.locked.resuming') : t('session.locked.resume')}
            </Button>
          )}
          <Button variant={expired ? 'primary' : 'ghost'} onClick={onLogout}>
            {expired ? t('auth.signIn') : t('session.locked.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}
