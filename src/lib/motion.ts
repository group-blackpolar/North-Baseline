/** Motion tokens mirrored from index.css (`--duration-*`, `--ease-*`). Use CSS for hover/press; Motion for enter/exit/layout. */
export const duration = { fast: 0.12, normal: 0.18, slow: 0.28 } as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  enter: [0, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring = {
  soft: { type: 'spring', stiffness: 300, damping: 30 },
  interactive: { type: 'spring', stiffness: 500, damping: 32 },
} as const;
