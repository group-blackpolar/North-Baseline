/* oxlint-disable react/only-export-components */
import { Component, createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { classifyError, type AppError, type AppErrorCode } from '@/lib/appErrors';
import { ErrorOverlay } from '@/components/errors/ErrorOverlay';

interface ErrorContextValue {
  raiseError: (code: AppErrorCode, detail?: string) => void;
  classifyAndRaise: (error: unknown) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

interface BoundaryProps {
  onCatch: (code: AppErrorCode, detail?: string) => void;
  children: ReactNode;
}

class ErrorBoundary extends Component<BoundaryProps, { hasError: boolean }> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onCatch(classifyError(error), error.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

export function ErrorProvider({ children, onLogout }: { children: ReactNode; onLogout?: () => void }) {
  const [active, setActive] = useState<AppError | null>(null);
  const [resetToken, setResetToken] = useState(0);

  const raiseError = useCallback((code: AppErrorCode, detail?: string) => {
    setActive({ id: crypto.randomUUID(), code, detail });
  }, []);

  const classifyAndRaise = useCallback((error: unknown) => {
    raiseError(classifyError(error), error instanceof Error ? error.message : undefined);
  }, [raiseError]);

  const handleCatch = useCallback((code: AppErrorCode, detail?: string) => {
    setActive({ id: crypto.randomUUID(), code: code === 'UNEXPECTED' ? 'UNEXPECTED' : code, detail });
  }, []);

  const retry = useCallback(() => {
    setActive(null);
    setResetToken((token) => token + 1);
  }, []);

  const value = useMemo(() => ({ raiseError, classifyAndRaise }), [raiseError, classifyAndRaise]);

  return (
    <ErrorContext.Provider value={value}>
      <ErrorBoundary key={resetToken} onCatch={handleCatch}>
        {children}
      </ErrorBoundary>
      {active && <ErrorOverlay error={active} onRetry={retry} onLogout={onLogout} />}
    </ErrorContext.Provider>
  );
}

export function useAppError() {
  const context = useContext(ErrorContext);
  if (!context) throw new Error('useAppError must be used within ErrorProvider');
  return context;
}

/** Versión segura para contexts que pueden montarse sin ErrorProvider */
export function useAppErrorSafe(): ErrorContextValue | null {
  return useContext(ErrorContext);
}

