import type { ReactNode } from 'react';

/**
 * Height collapse (grid 0fr <-> 1fr, no measuring). Closed content stays mounted but is `inert`
 * and hidden from assistive tech, so focus never lands in it. Reduced motion makes it instant.
 */
export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div className="np-collapse" data-open={open} aria-hidden={!open} inert={!open}>
      <div className="np-collapse-inner">{children}</div>
    </div>
  );
}
