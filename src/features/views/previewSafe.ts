import type { PanelDocument } from '@/lib/northAdmin';

export type PreviewSection = PanelDocument['sections'][number];

/** Preview seguro: nunca se renderiza HTML ni se reconstruye una URL arbitraria. */
export const safeHref = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol) ? value : null;
  } catch {
    return null;
  }
};

export const localizedText = (value: unknown, locale: string) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const entry = record[locale] ?? record.es ?? record.en ?? Object.values(record)[0];
  return typeof entry === 'string' ? entry : '';
};

/** Orden de resolución de locale: activo, default y luego fallbacks, sin duplicados. */
export const localizedList = (active: string[], defaultLocale: string, fallbacks: string[]) =>
  Array.from(new Set([...active, defaultLocale, ...fallbacks].filter(Boolean)));

export const richTextNodes = (props: Record<string, unknown>, locales: string[]): unknown[] => {
  const docs = props.documents as Record<string, unknown> | undefined;
  const doc = locales.map((entry) => docs?.[entry]).find(Boolean) ?? Object.values(docs ?? {})[0];
  const content = (doc as { content?: unknown[] } | undefined)?.content;
  return Array.isArray(content) ? content : [];
};
