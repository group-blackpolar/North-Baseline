import * as React from 'react'
import { cn } from '@/lib/utils'

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'text-[10px] font-mono px-2 py-1 rounded bg-panel-2 text-text-dim border border-line inline-block',
        className
      )}
      {...props}
    />
  )
}
