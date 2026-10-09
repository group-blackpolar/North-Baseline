import { useEffect, useState, type RefObject } from 'react';

/** Width of an element in CSS px, kept current with a ResizeObserver. Used for layouts that depend on the space the
 *  content really has (the shell's rails take a lot of the viewport), not on the viewport itself. */
export function useElementWidth(ref: RefObject<HTMLElement | null>, initial = 1024) {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.round(entry.contentRect.width)); });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
