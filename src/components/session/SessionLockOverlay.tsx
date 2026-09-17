import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

interface SessionLockOverlayProps {
  onResume: () => Promise<boolean>;
  onLogout: () => void;
}

export function SessionLockOverlay({ onResume, onLogout }: SessionLockOverlayProps) {
  const { t } = useI18n();
  const [resuming, setResuming] = useState(false);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-lock-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-md p-4"
    >
      <div className="np-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="mx-auto size-11 rounded-xl bg-surface-active flex items-center justify-center">
          <Lock className="w-5 h-5 text-text-secondary" />
        </div>
        <div className="space-y-1">
          <h1 id="session-lock-title" className="font-display text-lg font-semibold text-text">
            {t('session.locked.title')}
          </h1>
          <p className="text-sm text-text-secondary">{t('session.locked.body')}</p>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="primary"
            disabled={resuming}
            onClick={async () => {
              setResuming(true);
              await onResume();
              setResuming(false);
            }}
          >
            {resuming ? t('session.locked.resuming') : t('session.locked.resume')}
          </Button>
          <Button variant="ghost" onClick={onLogout}>
            {t('session.locked.logout')}
          </Button>
        </div>
      </div>
    </div>
  );
}