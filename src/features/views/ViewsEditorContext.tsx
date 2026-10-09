import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import type { ManagementCategory, TaxonomyPanel, PanelDocument } from '@/lib/northAdmin';
import { hasUnsafeContent } from '@/features/admin/contentDocument';
import { ApiError } from '@/lib/api';
import { getDraft, saveDraft } from '@/lib/northAdmin';
import { emptyHistory, record, redo as redoStep, undo as undoStep, type History } from './studio/history';
import { findComponent, setComponentProps } from './studio/documentOps';
import type { Device } from './studio/registry';

export type ActiveTabMode = 'editor' | 'settings' | 'revisions' | 'preview';

export interface SelectionState {
  categoryId?: string;
  subcategoryId?: string;
  panelId?: string;
  sectionId?: string;
  componentId?: string;
}

export type ModalState =
  | { type: 'create_category' }
  | { type: 'create_subcategory'; categoryId: string }
  | { type: 'create_view'; categoryId: string; subcategoryId: string }
  | { type: 'rename'; resourceType: 'category' | 'subcategory' | 'panel'; id: string; currentName: string; currentSlug: string }
  | { type: 'dev_json' }
  | null;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface CommitOptions {
  /** Edits sharing a key within a short window collapse into one undo step (typing, sliders). */
  key?: string;
}

interface ViewsEditorContextValue {
  organizationId: string;
  taxonomy: ManagementCategory[] | null;
  loading: boolean;
  activeMode: ActiveTabMode;
  setActiveMode: (mode: ActiveTabMode) => void;
  selection: SelectionState;
  selectCategory: (categoryId: string) => void;
  selectSubcategory: (categoryId: string, subcategoryId: string) => void;
  selectPanel: (categoryId: string, subcategoryId: string, panelId: string) => void;
  selectComponent: (sectionId: string, componentId: string) => void;
  selectSection: (sectionId: string) => void;
  clearComponentSelection: () => void;
  activePanel: TaxonomyPanel | null;
  activeDocument: PanelDocument | null;
  /** Replace the document from outside the editing flow (load, reload, restore). Clears local undo history. */
  setActiveDocument: (value: PanelDocument | null) => void;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  modal: ModalState;
  setModal: (modal: ModalState) => void;
  refreshTaxonomy: () => Promise<boolean>;
  // Studio editing: every change is a pure function of the previous document, recorded for local undo/redo.
  device: Device;
  setDevice: (device: Device) => void;
  /** Latest document, readable synchronously (event handlers that need ids produced by an operation). */
  getDocument: () => PanelDocument | null;
  commit: (next: PanelDocument, options?: CommitOptions) => void;
  edit: (updater: (doc: PanelDocument) => PanelDocument, options?: CommitOptions) => void;
  /** Merge props into one component (typing in the inspector collapses into a single undo step). */
  updateComponentProps: (sectionId: string, componentId: string, props: Record<string, unknown>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Bumps when the document is replaced from outside typing (undo, redo, reload, restore): remount uncontrolled inputs. */
  epoch: number;
  // etag + autosave status shared between canvas and toolbar
  etag: string;
  setEtag: (tag: string) => void;
  saveStatus: SaveStatus;
  setSaveStatus: (status: SaveStatus) => void;
  saveError: string | null;
  setSaveError: (error: string | null) => void;
  saveNow: () => Promise<boolean>;
  conflict: boolean;
  reloadDraft: () => Promise<void>;
}

const ViewsEditorContext = createContext<ViewsEditorContextValue | null>(null);

export function ViewsEditorProvider({
  children,
  organizationId,
  taxonomy,
  loading,
  refreshTaxonomy,
}: {
  children: ReactNode;
  organizationId: string;
  taxonomy: ManagementCategory[] | null;
  loading: boolean;
  refreshTaxonomy: () => Promise<boolean>;
}) {
  const [activeMode, setActiveMode] = useState<ActiveTabMode>('editor');
  const [selection, setSelection] = useState<SelectionState>({});
  const [activeDocument, setDocumentState] = useState<PanelDocument | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const [device, setDevice] = useState<Device>('desktop');
  const [etag, setEtag] = useState('');
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  // The document and its undo history live in refs so rapid gestures (several edits per frame) always chain from the
  // true latest state; React state mirrors them for rendering. Saves read the ref, so a change made while a request
  // is in flight is never lost or saved against a stale snapshot.
  const docRef = useRef<PanelDocument | null>(null);
  const historyRef = useRef<History<PanelDocument>>(emptyHistory());
  const [historyTick, setHistoryTick] = useState(0);
  const [epoch, setEpoch] = useState(0);
  const panelRef = useRef<string | undefined>(undefined);
  panelRef.current = selection.panelId;
  const etagRef = useRef('');
  // Last document known to match the server draft, and a queue so saves never overlap (overlap would race on the ETag).
  const savedDocRef = useRef<PanelDocument | null>(null);
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));
  etagRef.current = etag;

  const setActiveDocument = useCallback((value: PanelDocument | null) => {
    docRef.current = value;
    savedDocRef.current = value;
    historyRef.current = emptyHistory();
    setDocumentState(value);
    setHistoryTick((tick) => tick + 1);
    setEpoch((n) => n + 1);
  }, []);

  const commit = useCallback((next: PanelDocument, options?: CommitOptions) => {
    const previous = docRef.current;
    if (!previous || next === previous) return;
    historyRef.current = record(historyRef.current, previous, { key: options?.key });
    docRef.current = next;
    setDocumentState(next);
    setIsDirty(true);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const edit = useCallback((updater: (doc: PanelDocument) => PanelDocument, options?: CommitOptions) => {
    const current = docRef.current;
    if (current) commit(updater(current), options);
  }, [commit]);

  const updateComponentProps = useCallback((_sectionId: string, componentId: string, props: Record<string, unknown>) => {
    edit((doc) => setComponentProps(doc, componentId, props), { key: `props:${componentId}:${Object.keys(props).join(',')}` });
  }, [edit]);

  const undo = useCallback(() => {
    const current = docRef.current;
    if (!current) return;
    const step = undoStep(historyRef.current, current);
    if (!step) return;
    historyRef.current = step.history;
    docRef.current = step.state;
    setDocumentState(step.state);
    setIsDirty(true);
    setHistoryTick((tick) => tick + 1);
    setEpoch((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    const current = docRef.current;
    if (!current) return;
    const step = redoStep(historyRef.current, current);
    if (!step) return;
    historyRef.current = step.history;
    docRef.current = step.state;
    setDocumentState(step.state);
    setIsDirty(true);
    setHistoryTick((tick) => tick + 1);
    setEpoch((n) => n + 1);
  }, []);

  const resetForNewTarget = useCallback(() => {
    docRef.current = null;
    historyRef.current = emptyHistory();
    setDocumentState(null);
    setIsDirty(false);
    setHistoryTick((tick) => tick + 1);
  }, []);

  const selectCategory = useCallback((categoryId: string) => { setSelection({ categoryId }); resetForNewTarget(); }, [resetForNewTarget]);
  const selectSubcategory = useCallback((categoryId: string, subcategoryId: string) => { setSelection({ categoryId, subcategoryId }); resetForNewTarget(); }, [resetForNewTarget]);
  const selectPanel = useCallback((categoryId: string, subcategoryId: string, panelId: string) => { setSelection({ categoryId, subcategoryId, panelId }); resetForNewTarget(); }, [resetForNewTarget]);

  const selectComponent = useCallback((sectionId: string, componentId: string) => {
    setSelection((prev) => (prev.sectionId === sectionId && prev.componentId === componentId ? prev : { ...prev, sectionId, componentId }));
  }, []);
  const selectSection = useCallback((sectionId: string) => {
    setSelection((prev) => (prev.sectionId === sectionId && !prev.componentId ? prev : { ...prev, sectionId, componentId: undefined }));
  }, []);
  const clearComponentSelection = useCallback(() => {
    setSelection((prev) => (!prev.sectionId && !prev.componentId ? prev : { ...prev, sectionId: undefined, componentId: undefined }));
  }, []);

  const saveOnce = useCallback(async () => {
    const panelId = panelRef.current;
    const snapshot = docRef.current;
    if (!panelId || !snapshot) return false;
    // Nothing changed since the last load/save (a queued autosave that a previous save already covered).
    if (snapshot === savedDocRef.current && etagRef.current) return true;
    // Validación previa: nunca se envía contenido ejecutable al backend.
    if (hasUnsafeContent(snapshot)) {
      setSaveError('unsafe');
      setSaveStatus('error');
      setConflict(false);
      return false;
    }
    setSaveStatus('saving');
    setSaveError(null);
    try {
      const saved = await saveDraft(organizationId, panelId, snapshot, etagRef.current || undefined);
      // If the user switched view during the save, this etag no longer applies here.
      if (panelRef.current !== panelId) return true;
      setEtag(saved.etag);
      etagRef.current = saved.etag;
      savedDocRef.current = snapshot;
      // Edits made while the request was in flight stay dirty: only a still-identical document is "clean".
      setIsDirty(docRef.current !== snapshot);
      setConflict(false);
      setSaveStatus('saved');
      return true;
    } catch (error) {
      if (panelRef.current !== panelId) return false;
      // 409/412 = otra sesión guardó o publicó primero: no se sobrescribe.
      if (error instanceof ApiError && (error.status === 409 || error.status === 412)) {
        setConflict(true);
        setSaveStatus('error');
        setSaveError('conflict');
      } else {
        setSaveStatus('error');
        setSaveError(error instanceof Error ? error.message : 'Request failed');
      }
      return false;
    }
  }, [organizationId]);

  const saveNow = useCallback(() => {
    const run = saveChain.current.then(saveOnce, saveOnce);
    saveChain.current = run;
    return run;
  }, [saveOnce]);

  const reloadDraft = useCallback(async () => {
    const panelId = panelRef.current;
    if (!panelId) return;
    try {
      const draft = await getDraft(organizationId, panelId);
      if (panelRef.current !== panelId) return;
      setActiveDocument(draft.document);
      setEtag(draft.etag);
      etagRef.current = draft.etag;
      setIsDirty(false);
      setConflict(false);
      setSaveError(null);
      setSaveStatus('idle');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Request failed');
      setSaveStatus('error');
    }
  }, [organizationId, setActiveDocument]);

  const getDocument = useCallback(() => docRef.current, []);

  const activePanel = (selection.categoryId && selection.subcategoryId && selection.panelId && taxonomy)
    ? taxonomy
        .find((c) => c.id === selection.categoryId)
        ?.subcategories.find((s) => s.id === selection.subcategoryId)
        ?.panels.find((p) => p.id === selection.panelId) ?? null
    : null;

  // Undo can leave the selection pointing at a component that no longer exists; expose a selection that is always valid.
  const effectiveSelection = useMemo<SelectionState>(() => {
    if (!selection.componentId) return selection;
    const found = activeDocument ? findComponent(activeDocument, selection.componentId) : null;
    return found ? { ...selection, sectionId: found.section.id } : { ...selection, componentId: undefined };
  }, [selection, activeDocument]);

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  void historyTick;

  return (
    <ViewsEditorContext.Provider
      value={{
        organizationId, taxonomy, loading, activeMode, setActiveMode,
        selection: effectiveSelection, selectCategory, selectSubcategory, selectPanel, selectComponent, selectSection, clearComponentSelection,
        activePanel, activeDocument, setActiveDocument, isDirty, setIsDirty, modal, setModal, refreshTaxonomy,
        device, setDevice, getDocument, commit, edit, updateComponentProps, undo, redo, canUndo, canRedo, epoch,
        etag, setEtag, saveStatus, setSaveStatus, saveError, setSaveError, saveNow, conflict, reloadDraft,
      }}
    >
      {children}
    </ViewsEditorContext.Provider>
  );
}

export function useViewsEditor() {
  const ctx = useContext(ViewsEditorContext);
  if (!ctx) throw new Error('useViewsEditor must be used within ViewsEditorProvider');
  return ctx;
}
