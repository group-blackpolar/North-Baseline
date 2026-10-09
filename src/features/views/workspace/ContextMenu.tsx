import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { portalContainer } from '@/components/ui/portal';
import { cn } from '@/lib/utils';

export type MenuItem =
  | { type: 'separator' }
  | { type: 'item'; id: string; label: string; icon?: ReactNode; danger?: boolean; disabled?: boolean; hint?: string; onSelect: () => void };

/**
 * Pointer/keyboard context menu (role=menu). Opens at a viewport point, clamps itself inside the window, closes on
 * Escape / outside press / scroll, and supports arrow-key navigation. Items are supplied already authorized: the menu
 * never decides what a person may do — CORECROW does when the action runs.
 */
export function ContextMenu({ x, y, items, label, onClose }: { x: number; y: number; items: MenuItem[]; label: string; onClose: (restoreFocus?: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const { width, height } = node.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(x, window.innerWidth - width - 8)), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) });
    node.querySelector<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
  }, [x, y]);

  useEffect(() => {
    const press = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(false); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); onClose(true); } };
    window.addEventListener('pointerdown', press, true);
    window.addEventListener('keydown', key, true);
    const dismiss = () => onClose(false);
    window.addEventListener('blur', dismiss);
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('pointerdown', press, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('blur', dismiss);
      window.removeEventListener('resize', dismiss);
    };
  }, [onClose]);

  const move = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const entries = [...(ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])') ?? [])];
    const index = entries.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); entries[(index + 1) % entries.length]?.focus(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); entries[(index - 1 + entries.length) % entries.length]?.focus(); }
    else if (event.key === 'Home') { event.preventDefault(); entries[0]?.focus(); }
    else if (event.key === 'End') { event.preventDefault(); entries.at(-1)?.focus(); }
    else if (event.key === 'Tab') { event.preventDefault(); onClose(false); }
  };

  return createPortal(
    <div
      ref={ref} role="menu" aria-label={label} onKeyDown={move} onContextMenu={(event) => event.preventDefault()}
      style={{ position: 'fixed', left: position.left, top: position.top }}
      className="np-fade-in z-(--z-modal) min-w-48 max-w-72 rounded-lg border border-border bg-surface p-1 shadow-pop outline-none"
    >
      {items.map((item, index) => item.type === 'separator'
        ? <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-border" />
        : (
          <button
            key={item.id} role="menuitem" type="button" aria-disabled={item.disabled || undefined} tabIndex={-1}
            onClick={() => { if (item.disabled) return; onClose(false); item.onSelect(); }}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs outline-none transition-colors duration-(--duration-fast) pointer-coarse:min-h-(--touch-min)',
              item.disabled ? 'cursor-not-allowed text-text-muted opacity-50' : item.danger ? 'text-error hover:bg-error/10 focus-visible:bg-error/10' : 'text-text hover:bg-surface-hover focus-visible:bg-surface-hover',
            )}
          >
            {item.icon ? <span className="grid size-4 shrink-0 place-items-center text-text-muted">{item.icon}</span> : <span className="size-4 shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.hint ? <span className="shrink-0 text-[10px] text-text-muted">{item.hint}</span> : null}
          </button>
        ))}
    </div>,
    portalContainer() ?? document.body,
  );
}
