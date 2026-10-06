import type { ReactNode } from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { useMediaQuery } from '@/lib/responsive';
import { portalContainer } from './portal';

/** Mount once near the root. */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <RadixTooltip.Provider delayDuration={400} skipDelayDuration={0}>{children}</RadixTooltip.Provider>
);

/** Label for icon-only controls. Hidden on touch (hover does not exist there); never carries essential info. */
export function Tooltip({ label, children, side = 'top' }: { label: string; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  const coarse = useMediaQuery('(pointer: coarse)');
  if (coarse || !label) return <>{children}</>;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal container={portalContainer()}>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="np-tooltip z-(--z-toast) rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-text shadow-pop"
        >
          {label}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
