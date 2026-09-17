import { useState } from 'react';
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useNotifications, type NotificationType } from '@/context/NotificationContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  error: CircleAlert,
};

const TYPE_COLOR: Record<NotificationType, string> = {
  info: 'text-text-secondary',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
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

export function NotificationBell() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t('notifications.aria')}
        aria-expanded={open}
        className={cn(
          'relative h-7 w-7 rounded-md flex items-center justify-center transition-colors duration-150',
          open ? 'bg-surface-active text-text' : 'text-text-muted hover:bg-surface-hover hover:text-text'
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-accent text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1.5 w-80 np-card shadow-pop overflow-hidden">
            <div className="flex items-center justify-between px-3 h-9 border-b border-border/60">
              <span className="ui-label">{t('notifications.title')}</span>
              <button
                type="button"
                disabled={unreadCount === 0}
                className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary hover:text-text disabled:opacity-40 transition-colors duration-150"
                onClick={markAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t('notifications.markAll')}
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 && (
                <p className="px-3 py-8 text-center text-xs text-text-muted">{t('notifications.empty')}</p>
              )}
              {notifications.map((notification) => {
                const Icon = TYPE_ICON[notification.type];
                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      'w-full flex items-start gap-2.5 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-surface-hover',
                      !notification.read && 'bg-accent-soft/40'
                    )}
                    onClick={() => markRead(notification.id)}
                  >
                    <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', TYPE_COLOR[notification.type])} />
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="flex-1 truncate text-[13px] font-medium text-text">{notification.title}</span>
                        {!notification.read && <span className="size-1.5 rounded-full bg-accent shrink-0" />}
                      </span>
                      {notification.body && (
                        <span className="block text-xs text-text-secondary truncate">{notification.body}</span>
                      )}
                      <span className="block text-[10px] text-text-muted mt-0.5">
                        {timeAgo(notification.createdAt, locale)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}