import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full bg-panel-2 border border-line rounded-md px-3 py-2 text-sm font-mono text-text placeholder:text-text-dim outline-none focus:border-accent transition-colors',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'
