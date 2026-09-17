/* oxlint-disable react/only-export-components */
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[background-color,border-color,color,box-shadow,opacity] duration-150 focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-text text-background shadow-soft hover:opacity-90 active:opacity-95',
        accent: 'bg-accent text-white shadow-soft hover:bg-accent-hover',
        secondary: 'border border-border bg-surface-hover text-text hover:bg-surface-active',
        ghost: 'text-text-secondary hover:bg-surface-hover hover:text-text',
        outline: 'border border-border bg-transparent text-text hover:bg-surface-hover',
        destructive: 'bg-error text-white hover:opacity-90',
        /* deprecated: alias de primary, solo para compat con Login actual */
        dark: 'bg-text text-background shadow-soft hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4',
        lg: 'h-10 px-5',
        icon: 'h-8 w-8',
        'icon-sm': 'h-7 w-7',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = 'Button';

export { Button, buttonVariants };