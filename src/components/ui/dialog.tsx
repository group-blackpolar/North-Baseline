import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useIsCompactShell } from '@/lib/responsive';
import { IconButton } from './icon-button';
import { portalContainer } from './portal';
import { Sheet } from './sheet';

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  /** Desktop max width. */
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' } as const;

/** Centered modal on desktop; the same content as a bottom sheet on phone/tablet-portrait. */
export function Dialog({ size = 'md', ...props }: DialogProps) {
  const compact = useIsCompactShell();
  if (compact) return <Sheet {...props} side="bottom" />;
  const { open, onOpenChange, title, description, footer, children } = props;
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={portalContainer()}>
        <D.Overlay className="np-overlay fixed inset-0 z-(--z-modal) bg-black/40 backdrop-blur-[2px]" />
        <D.Content className={cn('np-dialog fixed left-1/2 top-1/2 z-(--z-modal) flex max-h-[85dvh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-surface shadow-overlay outline-none', WIDTH[size])}>
          <header className="flex items-start gap-3 px-5 pt-5 pb-3">
            <div className="min-w-0 flex-1">
              <D.Title className="font-display text-base font-semibold text-text">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-[13px] text-text-secondary">{description}</D.Description> : null}
            </div>
            <D.Close asChild><IconButton label="Close" icon={<X />} /></D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>
          {footer ? <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
