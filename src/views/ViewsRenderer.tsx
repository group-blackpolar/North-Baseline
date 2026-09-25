import type { SessionUser } from '@/lib/auth';
import type { Tab } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { Construction } from 'lucide-react';
import { SharkView } from '@/features/shark/SharkView';
import { PersonalView } from '@/features/personal/PersonalView';
import type { PublishedPanelDocument } from '@/lib/organizations';

const localized = (value: unknown, locales: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return String(locales.map((locale) => record[locale]).find((entry) => typeof entry === 'string') ?? Object.values(record).find((entry) => typeof entry === 'string') ?? '');
};
const safeHref = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try { return ['http:', 'https:', 'mailto:'].includes(new URL(value).protocol) ? value : null; } catch { return null; }
};
function RichNode({ node }: { node: unknown }) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;
  const value = node as { type?: string; text?: string; content?: unknown[]; href?: string };
  const children = Array.isArray(value.content) ? value.content.map((child, i) => <RichNode key={i} node={child} />) : null;
  if (value.type === 'text') return <>{value.text ?? ''}</>;
  if (value.type === 'paragraph') return <p className="leading-7">{children}</p>;
  if (value.type === 'heading') return <h3 className="font-display text-lg font-semibold">{children}</h3>;
  if (value.type === 'bullet_list') return <ul className="list-disc pl-6">{children}</ul>;
  if (value.type === 'ordered_list') return <ol className="list-decimal pl-6">{children}</ol>;
  if (value.type === 'list_item') return <li>{children}</li>;
  if (value.type === 'link') { const href = safeHref(value.href); return href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{children}</a> : <>{children}</>; }
  return <>{children}</>;
}
function PublishedPanel({ title, document, locales }: { title: string; document: PublishedPanelDocument | null; locales: string[] }) {
  if (!document) return <div className="p-6 text-sm text-text-muted">Este panel publicado no tiene contenido disponible.</div>;
  return <article className="mx-auto max-w-6xl space-y-6 p-6"><h1 className="font-display text-2xl font-semibold">{title}</h1>{document.sections.slice().sort((a, b) => a.order - b.order).map((section) => <section key={section.id} className="grid grid-cols-12 gap-4">{section.components.slice().sort((a, b) => a.order - b.order).map((component) => <div key={component.id} className="col-span-12 rounded-xl border border-border bg-surface p-4"><SafeComponent type={component.type} props={component.props} locales={locales} /></div>)}</section>)}</article>;
}
function SafeComponent({ type, props, locales }: { type: string; props: Record<string, unknown>; locales: string[] }) {
  if (type === 'heading') return <h2 className="font-display text-xl font-semibold">{localized(props.text, locales)}</h2>;
  if (type === 'rich_text') { const docs = props.documents as Record<string, unknown> | undefined; const document = locales.map((locale) => docs?.[locale]).find(Boolean) ?? Object.values(docs ?? {})[0]; return <RichNode node={document} />; }
  if (type === 'link') { const href = safeHref(props.href); return href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{localized(props.label, locales)}</a> : <span>{localized(props.label, locales)}</span>; }
  if (type === 'metric') return <div><p className="text-sm text-text-secondary">{localized(props.label, locales)}</p><p className="text-2xl font-semibold">{String(props.value ?? '—')}</p></div>;
  if (type === 'divider') return <hr className="border-border" />;
  if (type === 'list') { const items = Array.isArray(props.items) ? props.items : []; return <ul className="list-disc pl-6">{items.map((item, i) => { const value = item as Record<string, unknown>; const href = safeHref(value.href); const label = localized(value.text, locales); return <li key={i}>{href ? <a className="text-accent underline" href={href} target="_blank" rel="noreferrer">{label}</a> : label}</li>; })}</ul>; }
  // Asset/embed URLs are never reconstructed client-side. Task 12 adds signed reads.
  if (['image', 'video', 'file', 'card', 'table', 'embed'].includes(type)) return <p className="text-sm text-text-muted">Contenido disponible cuando los recursos autorizados estén configurados.</p>;
  return null;
}

// IDs de categorías especiales
const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences', 'settings']);
const SHARK_CATEGORIES = new Set(['shark-home', 'master-house']);



/** ViewRenderer principal: rutea según categoryId. */
export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Selecciona una categoría para comenzar
      </div>
    );
  }
  if (tab.publishedPanel) return <PublishedPanel title={tab.publishedPanel.title} document={tab.publishedPanel.document} locales={tab.publishedPanel.localeOrder} />;
    if (PERSONAL_CATEGORIES.has(tab.route.categoryId)) {
    return <PersonalView route={tab.route} user={user} />;
  }


  if (SHARK_CATEGORIES.has(tab.route.categoryId)) {
    return <SharkView route={tab.route} />;
  }

  // Fallback para categorías desconocidas
  return (
    <div className="p-6">
      <EmptyState
        icon={Construction}
        title="Vista en construcción"
        body={`La categoría "${tab.route.categoryId}" está siendo preparada.`}
        className="max-w-md"
      />
    </div>
  );
}
