import type { ReactNode } from 'react';
import type { IconComponent } from '@/components/ui/icon';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  body?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Glyph, title, body, action, secondaryAction, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong/60 bg-surface-hover/40 px-6 py-10 text-center',
        className
      )}
    >
      <div className="size-10 rounded-xl bg-surface-active flex items-center justify-center">
        <Icon icon={Glyph} size="lg" weight="duotone" className="text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="text-xs text-text-secondary max-w-60 leading-relaxed">{body}</p>}
      {(action || secondaryAction) && <div className="flex flex-wrap justify-center gap-2 pt-2">{action}{secondaryAction}</div>}
    </div>
  );
}