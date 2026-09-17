import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { getSession } from '@/lib/auth';
import { SessionLockOverlay } from '@/components/session/SessionLockOverlay';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hora
const CHECK_INTERVAL_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

export function SessionGuard({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const bump = () => {
      if (!lockedRef.current) lastActivity.current = Date.now();
    };
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, bump, { passive: true }));
    const interval = setInterval(() => {
      if (!lockedRef.current && Date.now() - lastActivity.current > INACTIVITY_TIMEOUT_MS) {
        lockedRef.current = true;
        setLocked(true);
      }
    }, CHECK_INTERVAL_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, bump));
      clearInterval(interval);
    };
  }, []);

  /** CoreCrow es la autoridad: reanudar solo si la sesión real sigue viva */
  const resume = useCallback(async (): Promise<boolean> => {
    try {
      const sessionUser = await getSession();
      if (!sessionUser) {
        onLogout();
        return false;
      }
      lastActivity.current = Date.now();
      lockedRef.current = false;
      setLocked(false);
      return true;
    } catch {
      onLogout();
      return false;
    }
  }, [onLogout]);

  return (
    <>
      {children}
      {locked && <SessionLockOverlay onResume={resume} onLogout={onLogout} />}
    </>
  );
}