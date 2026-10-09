import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { portalContainer } from '@/components/ui/portal';
import { cn } from '@/lib/utils';

type Placement = { left: number; width: number; top?: number; bottom?: number; maxHeight: number };
const MARGIN = 8;

/**
 * Anchored popover rendered in the shell portal, so a container with `overflow` can never clip it. It flips above the
 * anchor when there is more room there, stays inside the viewport, closes on Escape / outside press and gives focus
 * back to the anchor. The caller owns `open`.
 */
export function Popover({ open, onOpenChange, anchorRef, label, minWidth = 288, className, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  minWidth?: number;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, minWidth), window.innerWidth - MARGIN * 2);
    const left = Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN));
    const below = window.innerHeight - rect.bottom - MARGIN;
    const above = rect.top - MARGIN;
    setPlacement(below >= 280 || below >= above
      ? { left, width, top: rect.bottom + 4, maxHeight: Math.max(160, below - 4) }
      : { left, width, bottom: window.innerHeight - rect.top + 4, maxHeight: Math.max(160, above - 4) });
  }, [anchorRef, minWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchor?.contains(target)) return;
      onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onOpenChange(false);
      anchor?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => { document.removeEventListener('pointerdown', onPointerDown, true); document.removeEventListener('keydown', onKeyDown, true); };
  }, [anchorRef, onOpenChange, open]);

  const container = portalContainer() ?? document.body;
  if (!open || !placement) return null; // placement is computed in a layout effect, before the first paint
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      className={cn('fixed z-(--z-popover) flex flex-col overflow-hidden rounded-xl border border-border bg-surface text-text shadow-pop', className)}
      style={{ left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight }}
    >
      {children}
    </div>,
    container,
  );
}
