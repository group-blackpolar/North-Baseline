import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Title block for workspace pages. Actions wrap under the title on narrow widths. */
export function PageHeader({ title, description, actions, compact, className }: { title: string; description?: string; actions?: ReactNode; compact?: boolean; className?: string }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', compact ? 'mb-3' : 'mb-5', className)}>
      <div className="min-w-0">
        <h1 className={cn('font-display font-semibold tracking-tight text-text', compact ? 'text-xl' : 'text-[22px] md:text-[28px]')}>{title}</h1>
        {description ? <p className="mt-1 text-sm text-text-secondary">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  );
}
