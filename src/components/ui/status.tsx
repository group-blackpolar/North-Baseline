/* oxlint-disable react/only-export-components */
import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const statusVariants = cva('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4', {
  variants: {
    tone: {
      neutral: 'bg-surface-active text-text-secondary [--dot:var(--color-text-muted)]',
      active: 'bg-success/12 text-success [--dot:var(--color-success)]',
      pending: 'bg-warning/12 text-warning [--dot:var(--color-warning)]',
      info: 'bg-accent-soft text-accent [--dot:var(--color-accent)]',
      error: 'bg-error/12 text-error [--dot:var(--color-error)]',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

/** Semantic map for document/entity states; unknown values render neutral. */
export const STATUS_TONE: Record<string, NonNullable<VariantProps<typeof statusVariants>['tone']>> = {
  active: 'active', completed: 'active', sent: 'info', pending: 'pending', warning: 'pending',
  draft: 'neutral', archived: 'neutral', disabled: 'neutral', error: 'error', failed: 'error',
};

export function Status({ tone, className, children, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof statusVariants>) {
  return (
    <span className={cn(statusVariants({ tone }), className)} {...props}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-(--dot)" />
      {children}
    </span>
  );
}
