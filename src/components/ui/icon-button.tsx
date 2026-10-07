import { forwardRef } from 'react';
import { Button, type ButtonProps } from './button';
import { Tooltip } from './tooltip';

/** Icon-only button: `label` is mandatory (aria-label + tooltip). */
export const IconButton = forwardRef<HTMLButtonElement, Omit<ButtonProps, 'children' | 'aria-label'> & { label: string; icon: React.ReactNode }>(
  ({ label, icon, size = 'icon', variant = 'ghost', ...props }, ref) => (
    <Tooltip label={label}>
      <Button ref={ref} size={size} variant={variant} aria-label={label} {...props}>{icon}</Button>
    </Tooltip>
  )
);
IconButton.displayName = 'IconButton';
