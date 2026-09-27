import type { PanelDocument } from '@/lib/northAdmin';
import { newId } from '@/features/admin/contentDocument';

const localized = (text: string) => ({ es: text, en: text });
const layout = (w = 12, h = 2) => ({
  desktop: { x: 0, y: 0, w, h },
  tablet: { x: 0, y: 0, w, h },
  mobile: { x: 0, y: 0, w: 12, h },
});

export type ViewTemplateId = 'blank' | 'dashboard' | 'table' | 'settings' | 'profile';

export function createDocumentFromTemplate(template: ViewTemplateId, viewTitle: string): PanelDocument {
  const base: PanelDocument = {
    schemaVersion: 1,
    defaultLocale: 'es',
    fallbackLocales: ['en'],
    sections: [],
  };

  if (template === 'blank') {
    base.sections.push({
      id: newId(),
      order: 0,
      layout: { variant: 'grid', gap: 'md' },
      components: [
        {
          id: newId(),
          type: 'heading',
          schemaVersion: 1,
          order: 0,
          props: { text: localized(viewTitle || 'Nueva vista'), level: 1, align: 'left' },
          bindings: {},
          layout: layout(12, 1),
        },
      ],
    });
    return base;
  }

  if (template === 'dashboard') {
    base.sections.push({
      id: newId(),
      order: 0,
      layout: { variant: 'grid', gap: 'md' },
      components: [
        {
          id: newId(),
          type: 'heading',
          schemaVersion: 1,
          order: 0,
          props: { text: localized(viewTitle || 'Panel de métricas'), level: 1, align: 'left' },
          bindings: {},
          layout: layout(12, 1),
        },
        {
          id: newId(),
          type: 'metric',
          schemaVersion: 1,
          order: 1,
          props: { label: localized('Operaciones totales'), value: '1,420', format: 'number' },
          bindings: {},
          layout: layout(4, 2),
        },
        {
          id: newId(),
          type: 'metric',
          schemaVersion: 1,
          order: 2,
          props: { label: localized('Índice de actividad'), value: '98.5%', format: 'percentage' },
          bindings: {},
          layout: layout(4, 2),
        },
        {
          id: newId(),
          type: 'metric',
          schemaVersion: 1,
          order: 3,
          props: { label: localized('Alertas activas'), value: '0', format: 'number' },
          bindings: {},
          layout: layout(4, 2),
        },
      ],
    });
    return base;
  }

  if (template === 'table') {
    base.sections.push({
      id: newId(),
      order: 0,
      layout: { variant: 'grid', gap: 'md' },
      components: [
        {
          id: newId(),
          type: 'heading',
          schemaVersion: 1,
          order: 0,
          props: { text: localized(viewTitle || 'Registros'), level: 1, align: 'left' },
          bindings: {},
          layout: layout(12, 1),
        },
        {
          id: newId(),
          type: 'table',
          schemaVersion: 1,
          order: 1,
          props: {
            columns: [
              { key: 'name', label: localized('Nombre') },
              { key: 'status', label: localized('Estado') },
              { key: 'updatedAt', label: localized('Fecha') },
            ],
            rows: [],
          },
          bindings: {},
          layout: layout(12, 4),
        },
      ],
    });
    return base;
  }

  if (template === 'settings') {
    base.sections.push({
      id: newId(),
      order: 0,
      layout: { variant: 'grid', gap: 'md' },
      components: [
        {
          id: newId(),
          type: 'heading',
          schemaVersion: 1,
          order: 0,
          props: { text: localized(viewTitle || 'Ajustes'), level: 1, align: 'left' },
          bindings: {},
          layout: layout(12, 1),
        },
        {
          id: newId(),
          type: 'rich_text',
          schemaVersion: 1,
          order: 1,
          props: {
            documents: {
              es: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Configuración general de esta sección.' }] }] },
              en: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'General configuration for this section.' }] }] },
            },
          },
          bindings: {},
          layout: layout(12, 2),
        },
        {
          id: newId(),
          type: 'divider',
          schemaVersion: 1,
          order: 2,
          props: { variant: 'solid', spacing: 'md' },
          bindings: {},
          layout: layout(12, 1),
        },
      ],
    });
    return base;
  }

  // Profile template
  base.sections.push({
    id: newId(),
    order: 0,
    layout: { variant: 'grid', gap: 'md' },
    components: [
      {
        id: newId(),
        type: 'heading',
        schemaVersion: 1,
        order: 0,
        props: { text: localized(viewTitle || 'Perfil'), level: 1, align: 'left' },
        bindings: {},
        layout: layout(12, 1),
      },
      {
        id: newId(),
        type: 'card',
        schemaVersion: 1,
        order: 1,
        props: { title: localized('Detalles principales') },
        bindings: {},
        layout: layout(12, 3),
      },
    ],
  });

  return base;
}
