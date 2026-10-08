import { useOrganizationIconUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

/**
 * Organization icon source of truth: the managed asset (signed URL) wins, the legacy validated data URL is the
 * fallback, and `fallback` (initials) shows while loading or when the organization has no icon.
 */
export function OrganizationIcon({ organizationId, iconAssetId, iconData, fallback, className }: {
  organizationId?: string; iconAssetId?: string | null; iconData?: string | null; fallback: React.ReactNode; className?: string;
}) {
  const managed = useOrganizationIconUrl(organizationId ?? '', organizationId ? iconAssetId : null);
  const src = managed ?? iconData ?? null;
  return src ? <img src={src} alt="" className={cn('size-full object-cover', className)} /> : <>{fallback}</>;
}

/** Organization icon with the initials as fallback. */
export function OrganizationAvatar({ name, iconData, organizationId, iconAssetId, className }: { name: string; iconData?: string | null; organizationId?: string; iconAssetId?: string | null; className?: string }) {
  const initials = (name.trim() || '?').slice(0, 2).toUpperCase();
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-active font-display text-sm font-semibold text-text', className)} aria-hidden="true">
      <OrganizationIcon organizationId={organizationId} iconAssetId={iconAssetId} iconData={iconData} fallback={initials} />
    </span>
  );
}
