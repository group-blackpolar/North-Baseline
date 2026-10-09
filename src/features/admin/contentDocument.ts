import type { ComponentType, PanelDocument, ResponsiveLayout } from '@/lib/northAdmin';
import { defaultProps } from '@/features/views/studio/defaults';
import { uuid } from '@/lib/utils';

const layout = (): ResponsiveLayout => ({ desktop: { x: 0, y: 0, w: 12, h: 2 }, tablet: { x: 0, y: 0, w: 12, h: 2 }, mobile: { x: 0, y: 0, w: 12, h: 2 } });
export const newId = () => uuid();
export function emptyDocument(): PanelDocument { return { schemaVersion: 1, defaultLocale: 'es', fallbackLocales: ['en'], sections: [{ id: newId(), order: 0, layout: { variant: 'grid', gap: 'md' }, components: [] }] }; }
/** Schema-valid default props for a component type (single source of truth: the Studio registry defaults). */
export function componentProps(type: ComponentType): Record<string, unknown> { return defaultProps(type); }
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
