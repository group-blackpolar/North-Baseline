import type { Icon as PhosphorIcon, IconProps as PhosphorIconProps } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

/**
 * NORTH icon foundation (Phosphor). One library, one size scale, one weight rule:
 * `regular` for actions, navigation and inputs; `duotone` only for identity
 * (category headers, entity cards, empty states). Colour is always inherited.
 * (The brand mark lives in `components/brand/NorthLogo`.)
 */
export type IconComponent = PhosphorIcon;
export type IconWeight = NonNullable<PhosphorIconProps['weight']>;

export const ICON_SIZE = { xs: 14, sm: 16, md: 18, lg: 20, xl: 24, '2xl': 32 } as const;
export type IconSize = keyof typeof ICON_SIZE;

export function Icon({ icon: Glyph, size = 'sm', weight = 'regular', className, ...props }: { icon: IconComponent; size?: IconSize | number; weight?: IconWeight } & Omit<PhosphorIconProps, 'size' | 'weight'>) {
  return <Glyph size={typeof size === 'number' ? size : ICON_SIZE[size]} weight={weight} aria-hidden="true" className={cn('shrink-0', className)} {...props} />;
}
