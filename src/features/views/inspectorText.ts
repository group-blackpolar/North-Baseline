import type { PanelDocument } from '@/lib/northAdmin';

export type AnyComponent = PanelDocument['sections'][number]['components'][number];

export const getText = (value: unknown, locale: string): string => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  const entry = record[locale] ?? record.es ?? record.en ?? Object.values(record)[0];
  return typeof entry === 'string' ? entry : '';
};

export function docToLines(documents: unknown, locale: string): string {
  if (!documents || typeof documents !== 'object' || Array.isArray(documents)) return '';
  const doc = (documents as Record<string, unknown>)[locale] as {
    content?: Array<{ content?: Array<{ text?: string }> }>;
  } | undefined;
  if (!doc || !Array.isArray(doc.content)) return '';
  return doc.content
    .map((block) => (Array.isArray(block.content) ? block.content.map((run) => run.text ?? '').join('') : ''))
    .join('\n');
}

export function linesToDoc(line: string, fallback: unknown): unknown {
  const paragraphs = line
    .split('\n')
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] }));
  const base = (fallback as Record<string, unknown> | undefined) ?? {};
  return { ...base, type: 'doc', content: paragraphs.length > 0 ? paragraphs : [{ type: 'paragraph' }] };
}
