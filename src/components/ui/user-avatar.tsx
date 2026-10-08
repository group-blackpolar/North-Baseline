import { useOwnAvatarUrl } from '@/lib/assets';
import { cn } from '@/lib/utils';

/** The signed-in user's picture with initials as fallback. Updates everywhere when the avatar is replaced or removed. */
export function UserAvatar({ userId, name, className }: { userId: string; name: string; className?: string }) {
  const src = useOwnAvatarUrl(userId);
  return (
    <span aria-hidden="true" className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-accent-soft font-display text-xs font-semibold text-accent', className)}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : name.slice(0, 2).toUpperCase()}
    </span>
  );
}
