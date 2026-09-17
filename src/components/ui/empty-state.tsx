import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong/60 bg-surface-hover/40 px-6 py-10 text-center',
        className
      )}
    >
      <div className="size-10 rounded-xl bg-surface-active flex items-center justify-center">
        <Icon className="w-5 h-5 text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      {body && <p className="text-xs text-text-secondary max-w-60 leading-relaxed">{body}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}