import { useId } from 'react';

/** Cuervo, the NORTH assistant: a perched raven. It inherits `currentColor`; the eye and the folded wing are cut out. */
export function RavenIcon({ className, size = 20 }: { className?: string; size?: number }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false" className={className}>
      <defs>
        <mask id={mask} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          <circle cx="8.2" cy="7.6" r="0.85" fill="black" />
          <path d="M9.6 11.8c2.7.1 5.3 1.4 6.9 3.8" stroke="black" strokeWidth="0.9" strokeLinecap="round" fill="none" />
        </mask>
      </defs>
      <path mask={`url(#${mask})`} fill="currentColor" d="M1.4 9.2 5.5 7C6 5.2 7.6 4 9.5 4c1.9 0 3.4 1.2 3.9 3 3.2.8 6 3.3 7.6 7.1l2 4.5-4.6-1.3c-1.8.9-3.9 1.2-5.7 1C9.1 18.1 6.8 15.4 6.4 12.3l-.3-1.6-4.7-1.5Z" />
      <path d="M10 18.2 9.4 21.2M12.2 18.4l.7 2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" fill="none" />
    </svg>
  );
}
