// Credential helpers of the "create user" dialog (kept free of React so they can be tested).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** `SHARK-PASS-8nHFG31zTL`: organization prefix + 10 random characters from the browser's CSPRNG. */
export function generatePassword(slug: string) {
  const prefix = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16) || 'ORG';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `${prefix}-PASS-${Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('')}`;
}

/** Mirrors the server rule (first word, no accents) only to PREVIEW the address; the server assigns the real one. */
export const previewLocalPart = (name: string) => {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 40) || 'usuario';
};
