import type { ComponentType, PanelDocument, ResponsiveLayout } from '@/lib/northAdmin';

const layout = (): ResponsiveLayout => ({ desktop: { x: 0, y: 0, w: 12, h: 2 }, tablet: { x: 0, y: 0, w: 12, h: 2 }, mobile: { x: 0, y: 0, w: 12, h: 2 } });
const localized = (text: string) => ({ es: text, en: text });
export const newId = () => crypto.randomUUID();
export function emptyDocument(): PanelDocument { return { schemaVersion: 1, defaultLocale: 'es', fallbackLocales: ['en'], sections: [{ id: newId(), order: 0, layout: { variant: 'grid', gap: 'md' }, components: [] }] }; }
export function componentProps(type: ComponentType): Record<string, unknown> {
  switch (type) {
    case 'heading': return { text: localized('Título'), level: 2, align: 'left' };
    case 'rich_text': return { documents: { es: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texto' }] }] }, en: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Text' }] }] } } };
    case 'image': case 'video': case 'file': return { assetId: '' };
    case 'link': return { label: localized('Enlace'), href: 'https://example.com' };
    case 'table': return { columns: [{ key: 'value', label: localized('Valor') }], rows: [] };
    case 'card': return { title: localized('Tarjeta') };
    case 'list': return { items: [{ id: newId(), text: localized('Elemento') }] };
    case 'metric': return { label: localized('Métrica'), value: '0', format: 'number' };
    case 'divider': return { variant: 'solid', spacing: 'md' };
    case 'embed': return { url: 'https://www.youtube.com/', title: localized('Embed') };
  }
}
export function addComponent(document: PanelDocument, type: ComponentType): PanelDocument {
  const section = document.sections[0] ?? { id: newId(), order: 0, layout: { variant: 'grid' as const, gap: 'md' as const }, components: [] };
  const component = { id: newId(), type, schemaVersion: 1 as const, props: componentProps(type), bindings: {}, layout: layout(), order: section.components.length };
  return { ...document, sections: [{ ...section, components: [...section.components, component] }, ...document.sections.slice(1)] };
}
/** Reject obvious executable payloads before the server's authoritative schema validation. */
export function hasUnsafeContent(value: unknown): boolean {
  if (typeof value === 'string') return /<\/?[a-z][^>]*>|\bon[a-z]+\s*=|javascript:/i.test(value);
  if (Array.isArray(value)) return value.some(hasUnsafeContent);
  return Boolean(value && typeof value === 'object' && Object.entries(value).some(([key, item]) => /^(html|css|javascript|script|style|sql|query|credentials?|password|secret|token|headers?)$/i.test(key) || hasUnsafeContent(item)));
}
