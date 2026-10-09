import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, CircleNotch, Warning } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Sheet } from '@/components/ui/sheet';
import { componentProps, emptyDocument, hasUnsafeContent } from '@/features/admin/contentDocument';
import { ApiError } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { getDraft, readRevision, type PanelDocument } from '@/lib/northAdmin';
import { useElementWidth } from '@/lib/useElementWidth';
import { cn } from '@/lib/utils';
import { useViewsEditor } from '../ViewsEditorContext';
import { useViewsAutosave } from '../useViewsAutosave';
import { ViewsRevisionsTab } from '../ViewsRevisionsTab';
import { ViewsSettingsTab } from '../ViewsSettingsTab';
import { DevJsonModal } from '../DevJsonModal';
import { addComponent as addComponentOp, findComponent, validateStructure } from './documentOps';
import { clearPreviewCache } from './previewCache';
import { PublishDialog } from './PublishDialog';
import { clearRecovery, readRecovery, recoveryKey, shouldOffer, writeRecovery, type RecoveryEntry } from './recovery';
import { StudioCanvas } from './StudioCanvas';
import { StudioInspector } from './StudioInspector';
import { StudioLibrary, type LibraryHandle } from './StudioLibrary';
import { StudioToolbar } from './StudioToolbar';
import { listPanelBindings, validateDraftOnServer, type DraftReport, type PanelBinding } from './studioApi';
import { componentLabelKey } from './labels';

const COMPACT_BELOW = 1100;
const storage = (): Storage | null => { try { return window.sessionStorage; } catch { return null; } };
const isEditable = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

function usePanelBindings(organizationId: string, panelId: string | undefined) {
  const [bindings, setBindings] = useState<PanelBinding[]>([]);
  const generation = useRef(0);
  const reload = useCallback(async () => {
    if (!panelId) { setBindings([]); return; }
    const mine = ++generation.current;
    try {
      const next = await listPanelBindings(organizationId, panelId);
      if (mine === generation.current) setBindings(next);
    } catch {
      // Listing bindings needs edit permission; without it the editor still works, data tabs just show no bindings.
      if (mine === generation.current) setBindings([]);
    }
  }, [organizationId, panelId]);
  useEffect(() => { void reload(); }, [reload]);
  return { bindings, reload };
}

/** NORTH Views Studio: library · canvas · inspector over the persisted, versioned panel document. */
export function StudioEditor({ onExit }: { onExit: () => void }) {
  const { t, locale } = useI18n();
  const ctx = useViewsEditor();
  const { organizationId, selection, activePanel, activeDocument, activeMode, setActiveDocument, setEtag, setIsDirty, setSaveStatus, setSaveError, isDirty, etag, saveStatus, saveError, saveNow, conflict, reloadDraft, undo, redo, setActiveMode, device } = ctx;
  const panelId = selection.panelId;
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef, 1400);
  const compact = width < COMPACT_BELOW;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(() => { try { return localStorage.getItem('north-studio-library') !== '0'; } catch { return true; } });
  const [inspectorOpen, setInspectorOpen] = useState(() => { try { return localStorage.getItem('north-studio-inspector') !== '0'; } catch { return true; } });
  const [sheet, setSheet] = useState<'library' | 'inspector' | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [report, setReport] = useState<DraftReport | null>(null);
  const [validating, setValidating] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [recovery, setRecovery] = useState<RecoveryEntry<PanelDocument> | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);
  const [previewSource, setPreviewSource] = useState<'draft' | 'published'>('draft');
  const [publishedDoc, setPublishedDoc] = useState<PanelDocument | null>(null);
  const libraryRef = useRef<LibraryHandle>(null);
  const { bindings, reload: reloadBindings } = usePanelBindings(organizationId, panelId);
  const locales = useMemo(() => [locale, activeDocument?.defaultLocale ?? 'es', ...(activeDocument?.fallbackLocales ?? [])], [locale, activeDocument?.defaultLocale, activeDocument?.fallbackLocales]);

  useViewsAutosave();

  // ── Load the draft for the selected view ──
  useEffect(() => {
    if (!panelId) return;
    let alive = true;
    setLoading(true); setLoadError(null); setReport(null); setRecovery(null); setSaveStatus('idle'); setSaveError(null); setPreviewSource('draft'); setPublishedDoc(null);
    clearPreviewCache();
    (async () => {
      try {
        const draft = await getDraft(organizationId, panelId);
        if (!alive) return;
        setActiveDocument(draft.document); setEtag(draft.etag); setIsDirty(false);
        const entry = readRecovery<PanelDocument>(storage(), recoveryKey(organizationId, panelId));
        if (shouldOffer(entry, draft.etag, draft.document)) setRecovery(entry); else clearRecovery(storage(), recoveryKey(organizationId, panelId));
      } catch (reason) {
        if (!alive) return;
        if (reason instanceof ApiError && reason.status === 404) {
          // A view that was never saved: an empty, editable canvas (the first autosave creates revision 1).
          setActiveDocument(emptyDocument()); setEtag(''); setIsDirty(true);
        } else {
          setLoadError(reason instanceof Error ? reason.message : 'Error loading draft');
        }
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
    // The setters come from one provider and are stable; reload only when the target view changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, panelId]);

  // ── Recovery mirror ──
  useEffect(() => {
    if (!panelId || !activeDocument || loading) return;
    const key = recoveryKey(organizationId, panelId);
    if (!isDirty) { if (saveStatus === 'saved') clearRecovery(storage(), key); return; }
    const timer = window.setTimeout(() => writeRecovery(storage(), key, { baseEtag: etag, savedAt: Date.now(), document: activeDocument }), 800);
    return () => window.clearTimeout(timer);
  }, [organizationId, panelId, activeDocument, isDirty, etag, saveStatus, loading]);

  // ── Never lose work silently ──
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  // ── Server-side health after each successful save (debounced) ──
  const validate = useCallback(async (manual = false) => {
    if (!panelId) return;
    setValidating(true);
    try {
      if (manual && !(await saveNow())) return;
      setReport(await validateDraftOnServer(organizationId, panelId));
    } catch { /* validation is advisory here; publishing re-runs it and reports failures */ } finally { setValidating(false); }
  }, [organizationId, panelId, saveNow]);
  useEffect(() => {
    if (saveStatus !== 'saved' || isDirty || !panelId) return;
    const timer = window.setTimeout(() => void validate(false), 1200);
    return () => window.clearTimeout(timer);
  }, [saveStatus, isDirty, panelId, validate]);

  // ── Published preview source ──
  useEffect(() => {
    if (activeMode !== 'preview' || previewSource !== 'published' || !panelId || !activePanel?.publishedRevisionId) return;
    let alive = true;
    readRevision(organizationId, panelId, activePanel.publishedRevisionId).then((revision) => { if (alive) setPublishedDoc(revision.document); }).catch(() => { if (alive) setPublishedDoc(null); });
    return () => { alive = false; };
  }, [activeMode, previewSource, organizationId, panelId, activePanel?.publishedRevisionId]);

  // ── Adding components ──
  const openLibrary = useCallback((sectionId: string | null) => {
    if (sectionId) ctx.selectSection(sectionId);
    if (compact) setSheet('library'); else { setLibraryOpen(true); window.setTimeout(() => libraryRef.current?.focusSearch(), 0); }
  }, [compact, ctx]);

  const addFromLibrary = useCallback((type: string) => {
    const doc = ctx.getDocument();
    if (!doc) return;
    const target = ctx.selection.sectionId ?? doc.sections[doc.sections.length - 1]?.id ?? null;
    const added = addComponentOp(doc, target, { type, props: componentProps(type as never) });
    if (!added) return;
    ctx.commit(added.doc);
    ctx.selectComponent(added.sectionId, added.componentId);
    setFocusRequest((current) => ({ id: added.componentId, n: (current?.n ?? 0) + 1 }));
    if (compact) setSheet(null);
  }, [compact, ctx]);

  // ── Leaving ──
  const requestExit = async () => {
    if (!isDirty) { onExit(); return; }
    setExiting(true);
    const ok = await saveNow();
    setExiting(false);
    if (ok) onExit(); else setConfirmExit(true);
  };

  // ── Keyboard: scoped to the Studio, never hijacking text editing ──
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 's') { event.preventDefault(); void saveNow(); return; }
    if (isEditable(event.target)) return; // native text undo/redo and shortcuts inside fields
    if (mod && key === 'z' && !event.shiftKey) { event.preventDefault(); undo(); return; }
    if (mod && (key === 'y' || (key === 'z' && event.shiftKey))) { event.preventDefault(); redo(); return; }
    if (event.altKey && key === 'p') { event.preventDefault(); setActiveMode(activeMode === 'preview' ? 'editor' : 'preview'); return; }
    if (event.altKey && key === 'l') { event.preventDefault(); openLibrary(null); }
  };

  const issues = report ? { errors: report.issues.filter((issue) => issue.severity === 'error').length, warnings: report.issues.filter((issue) => issue.severity === 'warning').length } : null;
  const structural = useMemo(() => (activeDocument ? validateStructure(activeDocument) : []), [activeDocument]);
  const unsafe = saveError === 'unsafe' || (activeDocument ? hasUnsafeContent(activeDocument) : false);
  const selectedComponent = activeDocument && selection.componentId ? findComponent(activeDocument, selection.componentId)?.component : null;

  const toggleLibrary = () => { if (compact) setSheet(sheet === 'library' ? null : 'library'); else setLibraryOpen((open) => { try { localStorage.setItem('north-studio-library', open ? '0' : '1'); } catch { /* optional */ } return !open; }); };
  const toggleInspector = () => { if (compact) setSheet(sheet === 'inspector' ? null : 'inspector'); else setInspectorOpen((open) => { try { localStorage.setItem('north-studio-inspector', open ? '0' : '1'); } catch { /* optional */ } return !open; }); };

  // The measured root must exist from the first render, or the compact/regular switch would never observe it.
  if (!panelId || !activePanel) return <div ref={rootRef} className="flex-1" />;

  const body = (() => {
    if (loading) return <div className="flex flex-1 items-center justify-center gap-2 text-xs text-text-muted" aria-busy="true"><CircleNotch className="size-5 animate-spin" aria-hidden="true" />{t('admin.loading')}</div>;
    if (loadError) return <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center"><Warning className="size-8 text-error" aria-hidden="true" /><p className="max-w-sm text-sm text-error">{loadError}</p><Button size="sm" onClick={() => { setLoadError(null); setLoading(true); void reloadDraft().finally(() => setLoading(false)); }}>{t('admin.retry')}</Button></div>;
    if (!activeDocument) return null;
    if (activeMode === 'settings') return <div className="min-h-0 flex-1 overflow-y-auto p-6"><ViewsSettingsTab /></div>;
    if (activeMode === 'revisions') return <div className="min-h-0 flex-1 overflow-y-auto p-6"><ViewsRevisionsTab /></div>;
    if (activeMode === 'preview') {
      return (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-xs">
            <span className="text-text-muted">{t('st.preview.showing')}</span>
            {(['draft', 'published'] as const).map((source) => (
              <button key={source} type="button" aria-pressed={previewSource === source} disabled={source === 'published' && !activePanel.publishedRevisionId} onClick={() => setPreviewSource(source)}
                className={cn('h-6 rounded-md px-2 font-medium disabled:opacity-40', previewSource === source ? 'bg-accent text-white' : 'text-text-muted hover:bg-surface-hover')}>{t(source === 'draft' ? 'st.preview.draft' : 'st.preview.published')}</button>
            ))}
            {!activePanel.publishedRevisionId ? <span className="text-text-muted">{t('st.preview.neverPublished')}</span> : null}
          </div>
          <StudioCanvas readOnly bindings={bindings} locales={locales} onOpenLibrary={openLibrary} focusRequest={null} documentOverride={previewSource === 'published' ? publishedDoc ?? undefined : undefined} />
        </div>
      );
    }
    return <StudioCanvas bindings={bindings} locales={locales} onOpenLibrary={openLibrary} focusRequest={focusRequest} />;
  })();

  const showSide = activeMode === 'editor' && !loading && !loadError && Boolean(activeDocument);
  const inspector = <StudioInspector panelId={panelId} bindings={bindings} onBindingsChanged={reloadBindings} issues={report?.issues ?? []} onOpenLibrary={openLibrary} />;
  const library = <StudioLibrary ref={libraryRef} onAdd={addFromLibrary} inSheet={compact} />;

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background" onKeyDown={onKeyDown} data-studio-device={device}>
      <StudioToolbar
        compact={compact}
        exiting={exiting}
        issues={issues}
        onExit={() => void requestExit()}
        onPublish={() => setPublishOpen(true)}
        onValidate={() => void validate(true)}
        validating={validating}
        onToggleLibrary={toggleLibrary}
        onToggleInspector={toggleInspector}
        libraryOpen={sheet === 'library'}
        inspectorOpen={sheet === 'inspector'}
      />
      {(conflict || saveError === 'conflict') ? (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-b border-border bg-warning/10 px-4 py-2 text-xs text-text-secondary">
          <Warning className="size-4 shrink-0 text-warning" aria-hidden="true" /><span className="flex-1">{t('views.autosave.conflict')}</span>
          <Button size="sm" variant="outline" onClick={() => void reloadDraft()}>{t('views.autosave.reload')}</Button>
        </div>
      ) : null}
      {unsafe || (saveStatus === 'error' && saveError && saveError !== 'conflict' && saveError !== 'unsafe') ? (
        <div role="alert" className="flex shrink-0 items-center gap-2 border-b border-border bg-error/10 px-4 py-2 text-xs text-error"><Warning className="size-4 shrink-0" aria-hidden="true" /><span className="flex-1">{unsafe ? t('views.publishUnsafe') : saveError}</span>{!unsafe ? <Button size="sm" variant="outline" onClick={() => void saveNow()}>{t('admin.retry')}</Button> : null}</div>
      ) : null}
      {structural.length > 0 ? <div role="alert" className="shrink-0 border-b border-border bg-error/10 px-4 py-2 text-xs text-error">{t('st.structure.invalid')}</div> : null}
      {recovery ? (
        <div role="status" className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-accent/10 px-4 py-2 text-xs text-text">
          <ArrowCounterClockwise className="size-4 shrink-0 text-accent" aria-hidden="true" />
          <span className="flex-1">{t('st.recovery.found', { time: new Date(recovery.savedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) })}</span>
          <Button size="sm" variant="accent" onClick={() => { ctx.commit(recovery.document); setRecovery(null); }}>{t('st.recovery.restore')}</Button>
          <Button size="sm" variant="ghost" onClick={() => { clearRecovery(storage(), recoveryKey(organizationId, panelId)); setRecovery(null); }}>{t('st.recovery.discard')}</Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {showSide && !compact && libraryOpen ? <aside aria-label={t('st.library.title')} className="w-60 shrink-0 border-r border-border bg-surface">{library}</aside> : null}
        <main className="flex min-w-0 flex-1 flex-col" aria-label={t('st.canvas.title')}>{body}</main>
        {showSide && !compact && inspectorOpen ? <aside aria-label={t('st.inspector.title')} className="w-72 shrink-0 border-l border-border bg-surface min-[1500px]:w-80">{inspector}</aside> : null}
        {showSide && !compact ? (
          <div className="flex shrink-0 flex-col gap-1 border-l border-border bg-surface p-1">
            <Button size="icon-sm" variant={libraryOpen ? 'secondary' : 'ghost'} aria-pressed={libraryOpen} aria-label={t('st.library.title')} title={t('st.library.title')} onClick={toggleLibrary}><span aria-hidden="true" className="text-[10px] font-bold">L</span></Button>
            <Button size="icon-sm" variant={inspectorOpen ? 'secondary' : 'ghost'} aria-pressed={inspectorOpen} aria-label={t('st.inspector.title')} title={t('st.inspector.title')} onClick={toggleInspector}><span aria-hidden="true" className="text-[10px] font-bold">P</span></Button>
          </div>
        ) : null}
      </div>

      {compact ? (
        <>
          <Sheet open={sheet === 'library' && showSide} onOpenChange={(open) => setSheet(open ? 'library' : null)} title={t('st.library.title')} side="left">{library}</Sheet>
          <Sheet open={sheet === 'inspector' && showSide} onOpenChange={(open) => setSheet(open ? 'inspector' : null)} title={t('st.inspector.title')} side="right">{inspector}</Sheet>
        </>
      ) : null}

      <PublishDialog open={publishOpen} onClose={() => setPublishOpen(false)} onValidated={setReport} />
      <ConfirmDialog
        open={confirmExit}
        title={t('st.exit.title')}
        description={t('st.exit.description')}
        confirmLabel={t('st.exit.discard')}
        destructive
        onCancel={() => setConfirmExit(false)}
        onConfirm={() => { clearRecovery(storage(), recoveryKey(organizationId, panelId)); setConfirmExit(false); onExit(); }}
      />
      <DevJsonModal />
      <span className="sr-only" aria-live="polite">{selectedComponent ? t(componentLabelKey(selectedComponent.type)) : ''}</span>
    </div>
  );
}
