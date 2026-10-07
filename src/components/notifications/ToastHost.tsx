import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, Info, Warning, WarningCircle, X } from '@phosphor-icons/react';
import { Icon } from '@/components/ui/icon';
import { portalContainer } from '@/components/ui/portal';
import { useI18n } from '@/lib/i18n';
import { useShellMode } from '@/lib/responsive';
import type { AppNotification } from '@/context/NotificationContext';

const ICON = { success: CheckCircle, error: WarningCircle, warning: Warning, info: Info } as const;
const TONE = { success: 'text-success', error: 'text-error', warning: 'text-warning', info: 'text-accent' } as const;

/**
 * Transient toast for notifications pushed from this tab (the bell keeps the history).
 * Phone: bottom centre, above the safe area and above any sticky bottom bar (`data-bottom-bar`).
 * Larger screens: bottom right. Errors stay longer and are announced as alerts.
 */
export function ToastHost({ toast, onDismiss }: { toast: AppNotification | null; onDismiss: () => void }) {
  const { t } = useI18n();
  const phone = useShellMode() === 'phone';
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const bar = document.querySelector<HTMLElement>('[data-bottom-bar]');
    setBarHeight(bar ? bar.getBoundingClientRect().height : 0);
    const timer = window.setTimeout(onDismiss, toast.type === 'error' ? 7000 : 4500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const Glyph = ICON[toast.type];
  return createPortal(
    <div
      key={toast.id}
      role={toast.type === 'error' ? 'alert' : 'status'}
      className="np-toast fixed z-(--z-toast) flex items-start gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 shadow-overlay"
      style={phone
        ? { left: '50%', width: 'min(92vw, 28rem)', bottom: `calc(env(safe-area-inset-bottom) + 1rem + ${barHeight}px)`, translate: '-50% 0' }
        : { right: '1.5rem', bottom: '1.5rem', width: 'min(24rem, calc(100vw - 3rem))' }}
    >
      <Icon icon={Glyph} size="lg" weight="duotone" className={TONE[toast.type]} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{toast.title}</p>
        {toast.body ? <p className="mt-0.5 break-words text-xs text-text-secondary">{toast.body}</p> : null}
      </div>
      <button type="button" aria-label={t('common.close')} onClick={onDismiss} className="np-press-flat -mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-md text-text-muted hover:text-text pointer-coarse:size-(--touch-min)">
        <Icon icon={X} size="sm" />
      </button>
    </div>,
    portalContainer() ?? document.body,
  );
}
