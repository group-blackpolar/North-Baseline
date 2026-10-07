import { cn } from '@/lib/utils';

/** Organization icon (validated data URL from CORECROW) with the initials as fallback. */
export function OrganizationAvatar({ name, iconData, className }: { name: string; iconData?: string | null; className?: string }) {
  const initials = (name.trim() || '?').slice(0, 2).toUpperCase();
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-active font-display text-sm font-semibold text-text', className)} aria-hidden="true">
      {iconData ? <img src={iconData} alt="" className="size-full object-cover" /> : initials}
    </span>
  );
}
