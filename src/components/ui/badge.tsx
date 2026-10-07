import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'text-[10px] font-mono px-2 py-1 rounded bg-surface-hover text-text-secondary border border-border inline-block',
        className
      )}
      {...props}
    />
  )
}
