import { useEffect } from 'react';
import { Hand, X } from 'lucide-react';

export function WelcomeToast({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="status"
      className="fixed z-50 top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-xl animate-in fade-in"
    >
      <span className="h-9 w-9 rounded-full bg-accent/10 text-accent flex items-center justify-center">
        <Hand className="w-4 h-4" />
      </span>
      <div>
        <p className="font-display text-sm font-bold text-text">¡Bienvenido a North!</p>
        <p className="text-xs text-text-dim">Welcome to North!</p>
      </div>
      <button type="button" aria-label="Cerrar" className="ml-2 text-text-dim hover:text-text" onClick={onClose}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}