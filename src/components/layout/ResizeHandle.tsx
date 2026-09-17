import { useCallback, useRef } from 'react';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

interface ResizeHandleProps {
  axis: 'x' | 'y';
  /** +1: el panel crece hacia la derecha/abajo. -1: crece hacia la izquierda/arriba. */
  sign: 1 | -1;
}

export function ResizeHandle({ axis, sign }: ResizeHandleProps) {
  const { paneSize, setPaneSize, commitPaneSize, setDragging } = useLayout();
  const state = useRef({ start: 0, startSize: 0 });

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      state.current = {
        start: axis === 'x' ? event.clientX : event.clientY,
        startSize: paneSize,
      };
      setDragging(true);
      document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    },
    [axis, paneSize, setDragging]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.buttons === 0) return;
      const delta = (axis === 'x' ? event.clientX : event.clientY) - state.current.start;
      setPaneSize(state.current.startSize + sign * delta);
    },
    [axis, sign, setPaneSize]
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setDragging(false);
      commitPaneSize();
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    },
    [commitPaneSize, setDragging]
  );

  return (
    <div
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      className={cn(
        'shrink-0 group relative z-10',
        axis === 'x' ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div
        className={cn(
          'absolute inset-0 bg-transparent transition-colors duration-150 group-hover:bg-accent/40 group-active:bg-accent/60',
          axis === 'x' ? '-mx-1 mx-1' : '-my-1 my-1'
        )}
      />
    </div>
  );
}