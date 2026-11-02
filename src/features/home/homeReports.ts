/**
 * Generic organization Home presentation: accent tokens and the port photos shipped under /brand/cards (credits in CREDITS.md next to them).
 * Every organization gets a Home built from the categories its navigation already authorizes; per-tenant curation is content, not code.
 */
/** Accent as a theme token reference (`var(--chart-N)`), never a literal colour. */
export const GENERIC_ACCENTS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)', 'var(--chart-6)', 'var(--chart-7)'];
export const GENERIC_IMAGES = ['local-import', 'local-export', 'import-ctr', 'master-house', 'free-zone-import', 'free-zone-export', 'maritime-export'].map((name) => `/brand/cards/${name}.webp`);
