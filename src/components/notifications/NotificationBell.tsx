import { useRef, useState } from 'react';
import { Bell, CheckCircle, Checks, Info, Warning, WarningCircle } from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';
import { Popover } from '@/components/ui/popover';
import { useNotifications, type NotificationType } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const TYPE_ICON: Record<NotificationType, IconComponent> = { info: Info, success: CheckCircle, warning: Warning, error: WarningCircle };
const TYPE_TONE: Record<NotificationType, string> = {
  info: 'bg-accent-soft text-accent',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  error: 'bg-error/15 text-error',
};

function timeAgo(iso: string, locale: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return locale === 'es' ? 'ahora' : 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return locale === 'es' ? `hace ${minutes} min` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return locale === 'es' ? `hace ${hours} h` : `${hours}h ago`;
  return new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-US');
}

/** The bell and its panel (UX-01c). The panel is a portal popover: opaque, never clipped by a scroll area. */
export function NotificationBell({ className }: { className?: string }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={t('notifications.aria')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
        className={cn('relative grid size-9 place-items-center rounded-xl text-text-secondary shadow-[0_0_0_1px_var(--color-border),0_6px_16px_-8px_rgb(30_58_138/0.3)] transition-[color,box-shadow,background-color] duration-(--duration-fast) hover:text-text', open ? 'bg-surface-active text-text' : 'bg-gradient-to-b from-surface to-surface-hover', className)}
      >
        <Bell className="size-[18px]" weight={unreadCount > 0 ? 'fill' : 'regular'} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-polar px-1 text-[10px] font-bold text-white ring-2 ring-surface">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>
      <Popover open={open} onOpenChange={setOpen} anchorRef={anchor} label={t('notifications.title')} minWidth={360}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3.5">
          <span className="font-display text-[14px] font-bold">{t('notifications.title')}</span>
          <button type="button" disabled={unreadCount === 0} onClick={markAllRead} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-semibold text-polar transition-colors duration-(--duration-fast) hover:bg-accent-soft disabled:opacity-40 disabled:hover:bg-transparent">
            <Checks className="size-3.5" />{t('notifications.markAll')}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <span className="grid size-11 place-items-center rounded-full bg-surface-active text-text-muted"><Bell className="size-5" /></span>
              <p className="text-sm font-semibold text-text">{t('notifications.empty')}</p>
              <p className="text-xs text-text-secondary">{t('notifications.emptyHint')}</p>
            </div>
          ) : notifications.map((notification) => {
            const Glyph = TYPE_ICON[notification.type];
            return (
              <button key={notification.id} type="button" onClick={() => markRead(notification.id)} className={cn('flex w-full items-start gap-3 border-b border-border/60 px-3.5 py-3 text-left transition-colors duration-(--duration-fast) last:border-b-0 hover:bg-surface-hover', !notification.read && 'bg-accent-soft/50')}>
                <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', TYPE_TONE[notification.type])}><Glyph className="size-4" weight="duotone" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5"><span className="flex-1 truncate text-[13px] font-semibold text-text">{notification.title}</span>{!notification.read && <span className="size-1.5 shrink-0 rounded-full bg-polar" />}</span>
                  {notification.body ? <span className="mt-0.5 line-clamp-2 block text-xs text-text-secondary">{notification.body}</span> : null}
                  <span className="mt-1 block text-[10.5px] text-text-muted">{timeAgo(notification.createdAt, locale)}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Popover>
    </>
  );
}
