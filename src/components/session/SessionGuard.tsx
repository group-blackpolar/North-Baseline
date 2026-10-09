import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { checkSession } from '@/lib/auth';
import { SessionLockOverlay } from '@/components/session/SessionLockOverlay';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora
const CHECK_INTERVAL_MS = 15_000;
/** Returning from another app/tab after at least this long re-validates the session with CORECROW. */
const REVALIDATE_AFTER_HIDDEN_MS = 30_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

type Lock = 'inactivity' | 'expired' | null;

export function SessionGuard({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [locked, setLocked] = useState<Lock>(null);
  const lockedRef = useRef<Lock>(null);
  const lastActivity = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);

  const lock = useCallback((reason: Exclude<Lock, null>) => {
    lockedRef.current = reason;
    setLocked(reason);
  }, []);

  useEffect(() => {
    const bump = () => {
      if (!lockedRef.current) lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, bump, { passive: true }));
    const interval = setInterval(() => {
      if (!lockedRef.current && Date.now() - lastActivity.current > INACTIVITY_TIMEOUT_MS) lock('inactivity');
    }, CHECK_INTERVAL_MS);

    // Leaving the page (another app, another tab, a suspended mobile browser) must never reset the interface. On
    // return we only ask CORECROW whether the session is still alive: `unreachable` is ignored, never a sign-out.
    const revalidate = async () => {
      if (lockedRef.current) return;
      const check = await checkSession();
      if (check.status === 'anonymous') lock('expired');
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return; }
      const since = hiddenAt.current;
      hiddenAt.current = null;
      if (since !== null && Date.now() - since >= REVALIDATE_AFTER_HIDDEN_MS) void revalidate();
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) void revalidate(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, bump));
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [lock]);

  /** CoreCrow es la autoridad: reanudar solo si la sesión real sigue viva. A network failure keeps the lock (retry). */
  const resume = useCallback(async (): Promise<boolean> => {
    const check = await checkSession();
    if (check.status === 'anonymous') {
      if (lockedRef.current === 'inactivity') lock('expired');
      return false;
    }
    if (check.status === 'unreachable') return false;
    lastActivity.current = Date.now();
    lockedRef.current = null;
    setLocked(null);
    return true;
  }, [lock]);

  return (
    <>
      {children}
      {locked && <SessionLockOverlay key={locked} reason={locked} onResume={resume} onLogout={onLogout} />}
    </>
  );
}
