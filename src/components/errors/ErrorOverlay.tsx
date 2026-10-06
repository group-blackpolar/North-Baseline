import { Buildings, FolderMinus, LockKey, ShieldWarning, Timer, Warning, WifiSlash } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { AppError, AppErrorCode } from '@/lib/appErrors';


const ICONS: Record<AppErrorCode, IconComponent> = {
  API_UNAVAILABLE: WifiSlash,
  AUTH_ERROR: LockKey,
  PERMISSION_DENIED: ShieldWarning,
  WORKSPACE_UNAVAILABLE: FolderMinus,
  ORGANIZATION_UNAVAILABLE: Buildings,
  SESSION_EXPIRED: Timer,
  UNEXPECTED: Warning,
};

interface ErrorOverlayProps {
  error: AppError;
  onRetry: () => void;
  onLogout?: () => void;
}

export function ErrorOverlay({ error, onRetry, onLogout }: ErrorOverlayProps) {
  const { t } = useI18n();
  const Icon = ICONS[error.code];

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="app-error-title"
      className="fixed inset-0 z-(--z-modal) flex items-center justify-center bg-background/60 backdrop-blur-md p-4"
    >
      <div className="np-card w-full max-w-sm p-6 space-y-4 text-center">
        <div className="mx-auto size-11 rounded-xl bg-surface-active flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-secondary" />
        </div>
        <div className="space-y-1">
          <h1 id="app-error-title" className="font-display text-lg font-semibold text-text">
            {t(`error.${error.code}.title` as never)}
          </h1>
          <p className="text-sm text-text-secondary">{t(`error.${error.code}.body` as never)}</p>
        </div>
        {error.detail && <p className="mono-data text-xs text-text-muted break-words">{error.detail}</p>}
        <div className="flex flex-col gap-2 pt-1">
          <Button variant="primary" onClick={onRetry}>
            {t('error.retry')}
          </Button>
          {onLogout && (
            <Button variant="ghost" onClick={onLogout}>
              {t('error.logout')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}