import { useCallback, useRef } from 'react';
import { useLayout } from '@/context/LayoutContext';
import { cn } from '@/lib/utils';

export function ResizeHandle({ axis, sign }: { axis: 'x' | 'y'; sign: 1 | -1 }) {
  const { paneSize, setPaneSize, setDragging } = useLayout();
  const startSizeRef = useRef(0);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setDragging(true);
      const startPos = axis === 'x' ? event.clientX : event.clientY;
      startSizeRef.current = paneSize;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentPos = axis === 'x' ? moveEvent.clientX : moveEvent.clientY;
        const delta = (currentPos - startPos) * sign;
        const newSize = Math.max(200, Math.min(600, startSizeRef.current + delta));
        setPaneSize(newSize);
      };

      const handleMouseUp = () => {
        setDragging(false);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [axis, sign, paneSize, setPaneSize, setDragging]
  );

  return (
    <div
      className={cn(
        'shrink-0 bg-border/50 hover:bg-accent/50 transition-colors duration-150',
        axis === 'x' ? 'w-1 h-full cursor-col-resize' : 'h-1 w-full cursor-row-resize'
      )}
      onMouseDown={handleMouseDown}
    />
  );
}