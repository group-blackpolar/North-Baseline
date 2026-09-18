import { useState, useRef, useEffect } from 'react';
import { Loader2, LogOut } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useNotifications } from '@/context/NotificationContext';
import { useLogout } from '@/hooks/useLogout';
import type { SessionUser } from '@/lib/auth';

export function ProfileMenu({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { push } = useNotifications();
  const { logout, isLoggingOut } = useLogout();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = async () => {
    const { serverFailed } = await logout();
    if (serverFailed) {
      push({
        type: 'warning',
        title: t('profile.logoutLocalTitle') || 'Sesión cerrada localmente',
        body:
          t('profile.logoutLocalBody') ||
          'No se pudo invalidar en el servidor; se limpió tu sesión en este dispositivo.',
      });
    }
    // replace (no assign): sin entrada de historial → el botón atrás no vuelve al dashboard.
    // El kill-switch garantiza que el boot muestre Login aunque la cookie siga viva.
    window.location.replace('/');
  };

  const displayName = user.name ?? user.email;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-surface-hover transition-colors duration-150"
      >
        <div className="size-7 rounded-lg bg-accent-soft text-accent flex items-center justify-center font-display text-xs font-semibold shrink-0">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-text truncate">{displayName}</p>
          <p className="text-[10px] text-text-muted truncate">{user.email}</p>
        </div>
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 np-card p-1.5 space-y-0.5 shadow-pop z-50">
          <div className="px-2 py-2 border-b border-border">
            <p className="text-xs font-semibold text-text">{displayName}</p>
            <p className="text-[11px] text-text-muted mono-data truncate">{user.role}</p>
          </div>
          <button
            type="button"
            disabled={isLoggingOut}
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-text hover:bg-error/10 hover:text-error transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
            {isLoggingOut
              ? (t('profile.loggingOut') || 'Cerrando sesión…')
              : (t('profile.logout') || 'Cerrar sesión')}
          </button>
        </div>
      )}
    </div>
  );
}