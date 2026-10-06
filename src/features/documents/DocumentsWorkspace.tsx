import { useCallback, useEffect, useState } from 'react';
import { FileText, ShieldAlert } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { useShowcaseSlug } from '@/features/showcase/ShowcaseContext';
import { getDocument, listDocumentTypes, type DocumentDetail as DocumentRecord, type DocumentType, type DocumentTypes } from './api';
import { DocumentDetail, type DocumentCan } from './DocumentDetail';
import { DocumentEditor } from './DocumentEditor';
import { DocumentList } from './DocumentList';
import { errorText, localizedLabel } from './shared';

type View =
  | { mode: 'list' }
  | { mode: 'new' }
  | { mode: 'detail'; id: string; initial?: DocumentRecord }
  | { mode: 'edit'; document: DocumentRecord };

/**
 * Generic, organization-neutral document workspace: list, editor, detail, PDF and
 * delivery for one document type. Nothing here knows about a specific tenant; a
 * panel simply points at a type key. Permissions only drive what is shown, and
 * CORECROW authorizes every request.
 */
export function DocumentsWorkspace({ organizationId, typeKey }: { organizationId: string; typeKey: string }) {
  const { t, locale } = useI18n();
  const { can, isLoading: permissionsLoading } = usePermissions();
  const [config, setConfig] = useState<DocumentTypes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>({ mode: 'list' });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    setConfig(null); setError(null); setView({ mode: 'list' });
    void listDocumentTypes(organizationId).then((value) => { if (live) setConfig(value); }).catch((reason) => { if (live) setError(errorText(reason)); });
    return () => { live = false; };
  }, [organizationId]);

  const bump = useCallback(() => setRefreshKey((value) => value + 1), []);
  const type: DocumentType | undefined = config?.types.find((item) => item.key === typeKey);
  const permissions: DocumentCan & { read: boolean } = {
    read: can('documents.read'), create: can('documents.create'), update: can('documents.update'),
    delete: can('documents.delete'), download: can('documents.download'), send: can('documents.send'),
  };

  if (error) return <div className="mx-auto max-w-md p-6"><EmptyState icon={ShieldAlert} title={t('documents.unavailable')} body={error} /></div>;
  if (!config || permissionsLoading) return <div aria-busy="true" className="space-y-3 p-1"><Skeleton className="h-8 w-48" /><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  if (!type) return <div className="mx-auto max-w-md p-6"><EmptyState icon={FileText} title={t('documents.noType')} body={t('documents.noTypeHint')} /></div>;
  if (!permissions.read) return <div className="mx-auto max-w-md p-6"><EmptyState icon={ShieldAlert} title={t('documents.noAccess')} body={t('documents.noAccessHint')} /></div>;

  return (
    <section aria-label={localizedLabel(type.name, locale)} className="space-y-4">
      {view.mode === 'list' && (
        <>
          <header><h2 className="font-display text-xl font-semibold text-text">{localizedLabel(type.name, locale)}</h2><p className="text-xs text-text-muted">{t('documents.subtitle')}</p></header>
          <DocumentList organizationId={organizationId} type={type} can={permissions} refreshKey={refreshKey}
            onNew={() => setView({ mode: 'new' })} onOpen={(id) => setView({ mode: 'detail', id })}
            onEdit={(id) => { void getDocument(organizationId, id).then((document) => setView({ mode: 'edit', document })).catch((reason) => setError(errorText(reason))); }}
            onSend={(id) => setView({ mode: 'detail', id })} />
        </>
      )}
      {view.mode === 'new' && <DocumentEditor organizationId={organizationId} type={type} onCancel={() => setView({ mode: 'list' })} onSaved={(document) => { bump(); setView({ mode: 'detail', id: document.id, initial: document }); }} />}
      {view.mode === 'edit' && <DocumentEditor organizationId={organizationId} type={type} existing={view.document} onCancel={() => setView({ mode: 'detail', id: view.document.id, initial: view.document })} onSaved={(document) => { bump(); setView({ mode: 'detail', id: document.id, initial: document }); }} />}
      {view.mode === 'detail' && (
        <DocumentDetail key={view.id} organizationId={organizationId} documentId={view.id} initial={view.initial} can={permissions} channels={config.channels}
          onBack={() => setView({ mode: 'list' })} onEdit={(document) => setView({ mode: 'edit', document })} onChanged={bump} onDeleted={() => { bump(); setView({ mode: 'list' }); }} />
      )}
    </section>
  );
}

/** Rendered by published panels. Anonymous showcase visitors never get a document workspace. */
export function DocumentWorkspaceHost({ organizationId, props }: { organizationId: string | null | undefined; props: Record<string, unknown> }) {
  const showcase = useShowcaseSlug();
  const typeKey = typeof props.typeKey === 'string' ? props.typeKey : '';
  if (showcase || !organizationId || !typeKey) return null;
  return <DocumentsWorkspace key={`${organizationId}:${typeKey}`} organizationId={organizationId} typeKey={typeKey} />;
}
