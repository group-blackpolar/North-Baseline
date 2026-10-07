import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { IconButton } from './icon-button';
import { portalContainer } from './portal';

export type SheetSide = 'left' | 'right' | 'bottom';

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required for assistive tech; rendered visibly unless `hideTitle`. */
  title: string;
  description?: string;
  hideTitle?: boolean;
  side?: SheetSide;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

const SIDE: Record<SheetSide, string> = {
  left: 'inset-y-0 left-0 w-[min(88vw,320px)] border-r',
  right: 'inset-y-0 right-0 w-[min(92vw,420px)] border-l',
  bottom: 'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl border-t',
};

/** Drawer (left/right) or bottom sheet. Radix gives focus trap, scroll lock, Esc and aria; animation is CSS (`np-sheet`). */
export function Sheet({ open, onOpenChange, title, description, hideTitle, side = 'bottom', footer, className, children }: SheetProps) {
  const { t } = useI18n();
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={portalContainer()}>
        <D.Overlay className="np-overlay fixed inset-0 z-(--z-drawer) bg-black/40" />
        <D.Content
          data-side={side}
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn('np-sheet fixed z-(--z-drawer) flex flex-col border-border bg-surface shadow-overlay outline-none', SIDE[side], className)}
        >
          <header className={cn('flex items-start gap-3 px-4 pt-4 pb-2', hideTitle && 'sr-only')}>
            <div className="min-w-0 flex-1">
              <D.Title className="font-display text-base font-semibold text-text">{title}</D.Title>
              {description ? <D.Description className="mt-0.5 text-[13px] text-text-secondary">{description}</D.Description> : null}
            </div>
            <D.Close asChild><IconButton label={t('common.close')} icon={<X />} /></D.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer ? <footer className="border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</footer> : null}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
