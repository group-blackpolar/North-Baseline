import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import {
  safeHref,
  localizedText,
  localizedList,
  richTextNodes,
  type PreviewSection,
} from './previewSafe';

function RichTextNode({ node }: { node: unknown }) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const value = node as { type?: string; text?: string; content?: unknown[] };
  const children = Array.isArray(value.content) ? value.content.map((child, i) => <RichTextNode key={i} node={child} />) : null;
  if (value.type === 'text') return <>{value.text ?? ''}</>;
  if (value.type === 'paragraph') return <p className="leading-7">{children}</p>;
  return <>{children}</>;
}

export function ViewsPreview() {
  const { activePanel, activeDocument } = useViewsEditor();
  const { locale, t } = useI18n();
  const locales = localizedList(
    [locale],
    activeDocument?.defaultLocale ?? 'es',
    activeDocument?.fallbackLocales ?? [],
  );
  const name = (value: unknown) => localizedText(value, locale);

  if (!activeDocument || !activePanel) return null;

  return (
    <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-surface p-8 shadow-sm space-y-6">
      <h1 className="text-xl font-bold text-text">{name(activePanel.name)}</h1>
      {activeDocument.sections.map((section: PreviewSection) => (
        <div key={section.id} className="grid grid-cols-12 gap-4">
          {section.components.map((comp) => (
            <div key={comp.id} className="col-span-12">
              {comp.type === 'heading' && <h2 className="text-base font-semibold text-text">{name(comp.props.text)}</h2>}
              {comp.type === 'metric' && (
                <div className="rounded-xl border border-border p-4 bg-background">
                  <div className="text-xs text-text-muted">{name(comp.props.label)}</div>
                  <div className="text-2xl font-bold text-text mt-1">{String(comp.props.value ?? '—')}</div>
                </div>
              )}
              {comp.type === 'card' && (
                <div className="rounded-xl border border-border p-4 bg-background">
                  <h3 className="text-sm font-medium text-text">{name(comp.props.title)}</h3>
                </div>
              )}
              {comp.type === 'link' && (
                <a className="text-sm text-accent underline" href={safeHref(comp.props.href) ?? undefined} target="_blank" rel="noreferrer">
                  {name(comp.props.label)}
                </a>
              )}
              {comp.type === 'rich_text' && (
                <div className="text-sm text-text-secondary">
                  {richTextNodes(comp.props, locales).map((node, i) => (
                    <RichTextNode key={i} node={node} />
                  ))}
                </div>
              )}
              {comp.type === 'list' && (
                <ul className="list-disc pl-5 text-sm text-text-secondary">
                  {((comp.props.items as Array<{ text: unknown }> | undefined) ?? []).map((item, i) => (
                    <li key={i}>{name(item.text)}</li>
                  ))}
                </ul>
              )}
              {comp.type === 'table' && <PreviewTable props={comp.props} name={name} />}
              {comp.type === 'divider' && <hr className="border-border my-2" />}
              {['image', 'video', 'file', 'embed'].includes(comp.type) && (
                <p className="text-xs text-text-muted">{t('views.props.assetNote')}</p>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function PreviewTable({ props, name }: { props: Record<string, unknown>; name: (value: unknown) => string }) {
  const columns = (props.columns as Array<{ key: string; label: unknown }> | undefined) ?? [];
  const rows = (props.rows as Array<Record<string, unknown>> | undefined) ?? [];
  if (columns.length === 0) return null;
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key} className="border-b border-border py-1.5 pr-3 font-medium text-text">
              {name(col.label)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td key={col.key} className="border-b border-border/50 py-1.5 pr-3 text-text-secondary">
                {String(row[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
