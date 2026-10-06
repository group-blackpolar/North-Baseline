/**
 * Client-side totals use integer arithmetic (BigInt) so the live preview matches
 * CORECROW's exact decimal result: quantity has 3 decimals, price 2, the line is
 * rounded half-up to cents. CORECROW remains authoritative and recomputes on save.
 */
const QUANTITY = /^\d{1,4}(\.\d{1,3})?$/;
const PRICE = /^\d{1,7}(\.\d{1,2})?$/;

function scaled(value: string, decimals: number): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  return BigInt(whole + fraction.padEnd(decimals, '0').slice(0, decimals));
}

export const isQuantity = (value: string) => QUANTITY.test(value) && scaled(value, 3) > 0n;
export const isPrice = (value: string) => PRICE.test(value);

/** Line total in cents, or null while the inputs are incomplete or invalid. */
export function lineCents(quantity: string, unitPrice: string): bigint | null {
  if (!isQuantity(quantity) || !isPrice(unitPrice)) return null;
  const product = scaled(quantity, 3) * scaled(unitPrice, 2); // scale 10^-5
  return (product + 500n) / 1000n;
}

export const sumCents = (values: Array<bigint | null>) => values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n);

export function centsToText(cents: bigint) {
  const negative = cents < 0n;
  const absolute = negative ? -cents : cents;
  return `${negative ? '-' : ''}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function formatMoney(value: string, currency: string, locale?: string) {
  const [whole = '0', fraction = '00'] = value.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, locale === 'es' ? '.' : ',');
  const decimal = locale === 'es' ? ',' : '.';
  return `${currency === 'USD' ? '$' : `${currency} `}${grouped}${decimal}${fraction.padEnd(2, '0')}`;
}
