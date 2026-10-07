/* oxlint-disable react/only-export-components */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CircleNotch } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none select-none transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-(--duration-fast) ease-(--ease-standard) active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-text text-background shadow-soft hover:opacity-90 active:opacity-95',
        accent: 'bg-accent text-white shadow-soft hover:bg-accent-hover',
        secondary: 'border border-border bg-surface-hover text-text hover:border-border-hover hover:bg-surface-active',
        ghost: 'text-text-secondary hover:bg-surface-hover hover:text-text',
        outline: 'border border-border bg-transparent text-text hover:border-border-hover hover:bg-surface-hover',
        destructive: 'bg-error text-white hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-[13px] pointer-coarse:h-(--touch-min)',
        md: 'h-9 px-4 pointer-coarse:h-(--touch-min)',
        lg: 'h-10 px-5 pointer-coarse:h-(--touch-min)',
        icon: 'size-8 pointer-coarse:size-(--touch-min)',
        'icon-sm': 'size-7 pointer-coarse:size-(--touch-min)',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Shows a spinner, keeps the width, and blocks clicks. */
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {loading ? <CircleNotch className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };
