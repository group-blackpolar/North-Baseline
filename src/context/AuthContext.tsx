/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  completePendingOnboarding,
  getSession,
  logout as authLogout,
  type SessionUser,
} from '@/lib/auth';

interface AuthContextValue {
  user: SessionUser | null;
  isLoading: boolean;
  error: string | null;
  setUser: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const sessionUser = await getSession();
      if (sessionUser) {
        try {
          const onboarding = await completePendingOnboarding(sessionUser);
          setUser(onboarding?.user ?? sessionUser);
        } catch (err) {
          setUser(sessionUser);
          setError(
            err instanceof Error ? err.message : 'No fue posible completar el registro'
          );
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar sesión');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cerrar sesión');
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, error, setUser, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

   