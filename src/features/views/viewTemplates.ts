// Starting points for a new view. A template is a *generic, schema-valid document* — never data: KPI and chart
// placeholders carry no numbers and no bindings, so a view created from one shows "—" / "connect data" until an
// administrator connects the organization's own datasets (the publish check blocks unconnected charts). Creating a view
// from a template makes an independent copy; nothing stays shared with the template afterwards.
import type { PanelDocument } from '@/lib/northAdmin';
import { defaultProps } from './studio/defaults.ts';
import { addComponent, addSection, setComponentCell } from './studio/documentOps.ts';
import type { Cell } from './studio/grid.ts';

export type ViewTemplateId = 'blank' | 'executive' | 'analytics' | 'operations' | 'explorer' | 'presentation';
export const VIEW_TEMPLATES: ViewTemplateId[] = ['blank', 'executive', 'analytics', 'operations', 'explorer', 'presentation'];

const text = (value: string) => ({ es: value, en: value });
const bilingual = (es: string, en: string) => ({ es, en });
const paragraph = (es: string, en: string) => ({
  documents: {
    es: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: es }] }] },
    en: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: en }] }] },
  },
});

type Piece = { type: string; cell: Cell; props?: Record<string, unknown> };
const kpi = (index: number, count: number, es: string, en: string, row = 0): Piece => {
  const w = Math.floor(12 / count);
  return { type: 'metric', cell: { x: index * w, y: row, w, h: 2 }, props: { label: bilingual(es, en), format: 'number' } };
};

function build(sections: Array<{ name?: { es: string; en: string }; pieces: Piece[] }>): PanelDocument {
  let doc: PanelDocument = { schemaVersion: 1, defaultLocale: 'es', fallbackLocales: ['en'], sections: [] };
  for (const section of sections) {
    const created = addSection(doc);
    if (!created) break;
    doc = created.doc;
    if (section.name) doc = { ...doc, sections: doc.sections.map((item) => (item.id === created.sectionId ? { ...item, name: section.name } : item)) };
    for (const piece of section.pieces) {
      const added = addComponent(doc, created.sectionId, { type: piece.type, props: { ...defaultProps(piece.type as never), ...piece.props } });
      if (!added) continue;
      // Position on desktop only; tablet and mobile keep the stacked defaults from the component's registry size.
      doc = setComponentCell(added.doc, added.componentId, 'desktop', piece.cell);
    }
  }
  return doc;
}

export function createDocumentFromTemplate(template: ViewTemplateId, viewTitle: string): PanelDocument {
  const heading = (es: string, en: string): Piece => ({ type: 'heading', cell: { x: 0, y: 0, w: 12, h: 1 }, props: { text: viewTitle ? text(viewTitle) : bilingual(es, en), level: 1, align: 'left' } });
  const note = (es: string, en: string, y: number): Piece => ({ type: 'rich_text', cell: { x: 0, y, w: 12, h: 2 }, props: paragraph(es, en) });

  switch (template) {
    case 'executive':
      return build([
        { pieces: [heading('Resumen ejecutivo', 'Executive summary')] },
        { name: bilingual('Indicadores clave', 'Key indicators'), pieces: [kpi(0, 4, 'Indicador 1', 'Metric 1'), kpi(1, 4, 'Indicador 2', 'Metric 2'), kpi(2, 4, 'Indicador 3', 'Metric 3'), kpi(3, 4, 'Indicador 4', 'Metric 4')] },
        { name: bilingual('Tendencias', 'Trends'), pieces: [
          { type: 'line_chart', cell: { x: 0, y: 0, w: 8, h: 6 }, props: { title: bilingual('Evolución', 'Trend') } },
          { type: 'donut_chart', cell: { x: 8, y: 0, w: 4, h: 6 }, props: { title: bilingual('Distribución', 'Breakdown') } },
        ] },
        { name: bilingual('Detalle', 'Detail'), pieces: [{ type: 'table', cell: { x: 0, y: 0, w: 12, h: 5 } }] },
      ]);
    case 'analytics':
      return build([
        { pieces: [heading('Análisis', 'Analytics'), note('Conecta cada componente a una conexión de datos desde la pestaña Datos. Los filtros que permitas aparecerán arriba para quien lea la vista.', 'Connect each component to a data connection from the Data tab. The filters you allow appear at the top for readers of the view.', 1)] },
        { name: bilingual('Indicadores', 'Indicators'), pieces: [kpi(0, 3, 'Indicador 1', 'Metric 1'), kpi(1, 3, 'Indicador 2', 'Metric 2'), kpi(2, 3, 'Indicador 3', 'Metric 3')] },
        { name: bilingual('Gráficos', 'Charts'), pieces: [
          { type: 'bar_chart', cell: { x: 0, y: 0, w: 6, h: 6 }, props: { title: bilingual('Comparación', 'Comparison') } },
          { type: 'line_chart', cell: { x: 6, y: 0, w: 6, h: 6 }, props: { title: bilingual('Evolución', 'Trend') } },
        ] },
        { name: bilingual('Registros', 'Records'), pieces: [{ type: 'table', cell: { x: 0, y: 0, w: 12, h: 6 } }] },
      ]);
    case 'operations':
      return build([
        { pieces: [heading('Monitoreo operativo', 'Operational monitoring')] },
        { name: bilingual('Estado', 'Status'), pieces: [kpi(0, 4, 'En curso', 'In progress'), kpi(1, 4, 'Completadas', 'Completed'), kpi(2, 4, 'Con alertas', 'With alerts'), kpi(3, 4, 'Pendientes', 'Pending')] },
        { name: bilingual('Actividad', 'Activity'), pieces: [
          { type: 'bar_chart', cell: { x: 0, y: 0, w: 7, h: 6 }, props: { title: bilingual('Actividad por categoría', 'Activity by category') } },
          { type: 'list', cell: { x: 7, y: 0, w: 5, h: 6 }, props: { items: [{ id: 'a', text: bilingual('Describe aquí las alertas a vigilar', 'Describe the alerts to watch here') }] } },
        ] },
      ]);
    case 'explorer':
      return build([
        { pieces: [heading('Explorador de datos', 'Data explorer'), note('Esta tabla muestra todas las columnas de la conexión que le asignes. Permite filtros a los lectores desde la pestaña Datos.', 'This table shows every column of the connection you assign. Allow reader filters from the Data tab.', 1)] },
        { pieces: [{ type: 'table', cell: { x: 0, y: 0, w: 12, h: 10 } }] },
      ]);
    case 'presentation':
      // One section per scene: the presentation mode shows each section full-screen on a 16:9 stage, titled by its heading.
      return build([
        { name: bilingual('Escena 1', 'Scene 1'), pieces: [heading('Introducción', 'Introduction'), note('Resume el objetivo de la reunión.', 'Summarize the purpose of the meeting.', 1)] },
        { name: bilingual('Escena 2', 'Scene 2'), pieces: [
          { type: 'heading', cell: { x: 0, y: 0, w: 12, h: 1 }, props: { text: bilingual('Resultados', 'Results'), level: 2, align: 'left' } },
          kpi(0, 3, 'Indicador 1', 'Metric 1', 1), kpi(1, 3, 'Indicador 2', 'Metric 2', 1), kpi(2, 3, 'Indicador 3', 'Metric 3', 1),
          { type: 'bar_chart', cell: { x: 0, y: 3, w: 12, h: 6 }, props: { title: bilingual('Comparación', 'Comparison') } },
        ] },
        { name: bilingual('Escena 3', 'Scene 3'), pieces: [
          { type: 'heading', cell: { x: 0, y: 0, w: 12, h: 1 }, props: { text: bilingual('Detalle', 'Detail'), level: 2, align: 'left' } },
          { type: 'table', cell: { x: 0, y: 1, w: 12, h: 6 } },
        ] },
      ]);
    default:
      return build([{ pieces: [heading('Nueva vista', 'New view')] }]);
  }
}
