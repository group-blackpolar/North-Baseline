import { useCallback, useState } from 'react';
import { getSession, logout as authLogout } from '@/lib/auth';
import { clearLocalSession, markSessionKilled } from '@/lib/sessionCleanup';

/** Logout orquestado:
 *  1) intenta invalidar en CoreCrow (Identity / Sessions);
 *  2) VERIFICA la invalidación con get-session y reintenta una vez;
 *  3) SIEMPRE limpia el estado local y activa el kill-switch, aunque el servidor falle. */
export function useLogout() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async (): Promise<{ serverFailed: boolean }> => {
    setIsLoggingOut(true);
    let serverFailed = false;
    try {
      await authLogout();

      // Verificación: ¿la sesión sigue viva? (cookie zombi / sign-out fallido)
      let session = await getSession();
      if (session) {
        await authLogout(); // reintento único
        session = await getSession();
      }
      serverFailed = session !== null;
    } catch {
      serverFailed = true;
    } finally {
      clearLocalSession();
      markSessionKilled();
      setIsLoggingOut(false);
    }
    return { serverFailed };
  }, []);

  return { logout, isLoggingOut };
}