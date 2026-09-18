import { cn } from '@/lib/utils';

/** Icono oficial de NORTH theme-aware:
 *  light → black512 (silueta negra), dark/midnight → white512 (silueta blanca).
 *  El switch es puro CSS vía [data-theme] en <html> (ver index.css). */
export function NorthIcon({ className }: { className?: string }) {
  return (
    <span className={cn('grid place-items-center shrink-0', className)} aria-hidden="true">
      <img
        src="/black512.png"
        alt=""
        className="north-icon-light col-start-1 row-start-1 size-full object-contain"
      />
      <img
        src="/white512.png"
        alt=""
        className="north-icon-dark col-start-1 row-start-1 size-full object-contain"
      />
    </span>
  );
}

/** Lockup: icono oficial + wordmark opcional. Úsalo en login, rail y empty states. */
export function NorthLogo({
  withWordmark = false,
  className,
}: {
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <NorthIcon className="size-9" />
      {withWordmark && (
        <span className="font-display font-bold text-text tracking-[0.08em]">NORTH</span>
      )}
    </span>
  );
}