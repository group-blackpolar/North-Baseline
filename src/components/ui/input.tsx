import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-surface px-3 py-1 text-base md:text-sm text-text pointer-coarse:h-(--touch-min) shadow-soft outline-none transition-[border-color,box-shadow] duration-(--duration-fast) placeholder:text-text-muted hover:border-border-strong focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 aria-invalid:border-error aria-invalid:ring-error/20 disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };