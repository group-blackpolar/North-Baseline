import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { CaretUp } from '@phosphor-icons/react';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const PEEK = 64; // px of the sheet visible when collapsed (handle + title)

/**
 * Draggable bottom panel. Collapsed it shows only the grip and title; drag the handle up/down (or press
 * Enter/Space on it) to expand/collapse. Hidden content is `inert`, so it never takes focus.
 */
export function GalleryBottomSheet({ expanded, onExpandedChange, title, children }: { expanded: boolean; onExpandedChange: (value: boolean) => void; title: string; children: ReactNode }) {
  const { t } = useI18n();
  const sheet = useRef<HTMLDivElement>(null);
  const start = useRef<{ y: number; at: number; from: number; range: number } | null>(null);
  const dragged = useRef(false); // a drag ends with a click on the same button: ignore it
  const [offset, setOffset] = useState<number | null>(null);

  const down = (event: PointerEvent) => {
    dragged.current = false;
    const range = Math.max(0, (sheet.current?.offsetHeight ?? 0) - PEEK);
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { y: event.clientY, at: performance.now(), from: expanded ? 0 : range, range };
  };
  const move = (event: PointerEvent) => {
    const s = start.current;
    if (s) setOffset(Math.min(Math.max(s.from + event.clientY - s.y, 0), s.range));
  };
  const up = (event: PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const moved = event.clientY - s.y;
    const speed = moved / Math.max(1, performance.now() - s.at); // px/ms, negative = upwards
    setOffset(null);
    dragged.current = Math.abs(moved) >= 4;
    if (!dragged.current) return; // a tap: the click handler toggles
    onExpandedChange(Math.abs(speed) > 0.4 ? speed < 0 : s.from + moved < s.range / 2);
  };

  return (
    <div
      ref={sheet}
      className={cn('absolute inset-x-0 bottom-0 z-10 flex h-[min(78dvh,640px)] flex-col rounded-t-2xl border border-b-0 border-border bg-surface text-text shadow-overlay', offset === null && 'transition-transform duration-(--duration-slow) ease-(--ease-standard) motion-reduce:transition-none')}
      style={{ transform: offset === null ? (expanded ? 'translateY(0)' : `translateY(calc(100% - ${PEEK}px))`) : `translateY(${offset}px)` }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={expanded ? t('media.collapse') : t('media.expand')}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClick={() => { if (dragged.current) dragged.current = false; else onExpandedChange(!expanded); }}
        className="flex h-16 shrink-0 touch-none flex-col items-center justify-center gap-1.5 rounded-t-2xl outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      >
        <span className="h-1 w-10 rounded-full bg-border-strong" aria-hidden="true" />
        <span className="flex items-center gap-1 font-display text-sm font-semibold">
          {title}<CaretUp className={cn('size-3.5 transition-transform motion-reduce:transition-none', expanded && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      <div inert={!expanded} className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  );
}
