// Organization branding: the two brand colors an organization admin chooses. They are applied as CSS custom properties on
// the app shell (see `.north-app-shell[data-brand]` in index.css), so every tab, chart and control of that organization
// carries its identity while NORTH's own structure and typography stay intact.
export const BRAND_HEX = /^#[0-9A-Fa-f]{6}$/;
export const isBrandHex = (value: unknown): value is string => typeof value === 'string' && BRAND_HEX.test(value);

export type OrganizationBrand = { brandPrimary?: string | null; brandAccent?: string | null };
export type OrganizationIdentity = OrganizationBrand & { iconData?: string | null; iconAssetId?: string | null };

/** Identity fields of whatever organization shape the context holds (API organization or the local Personal workspace). */
export const identityOf = (organization: unknown): OrganizationIdentity => (organization && typeof organization === 'object' ? organization as OrganizationIdentity : {});

/** Inline style for the shell, or undefined when the organization has no valid brand colors (NORTH defaults apply). */
export function brandStyle(brand: OrganizationBrand | null | undefined): Record<string, string> | undefined {
  const accent = isBrandHex(brand?.brandAccent) ? brand!.brandAccent! : isBrandHex(brand?.brandPrimary) ? brand!.brandPrimary! : null;
  if (!accent) return undefined;
  const primary = isBrandHex(brand?.brandPrimary) ? brand!.brandPrimary! : accent;
  return { '--brand-accent': accent, '--brand-primary': primary };
}

/** WCAG relative luminance of a #RRGGBB color (0 = black, 1 = white). */
export function luminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export const contrastRatio = (a: string, b: string): number => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
};

/** Text color that stays readable on the given brand background. */
export const readableOn = (background: string): '#FFFFFF' | '#16181D' => (contrastRatio(background, '#FFFFFF') >= contrastRatio(background, '#16181D') ? '#FFFFFF' : '#16181D');
