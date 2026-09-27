import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ManagementCategory, TaxonomyPanel, PanelDocument } from '@/lib/northAdmin';

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
  | null;

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
  clearComponentSelection: () => void;
  activePanel: TaxonomyPanel | null;
  activeDocument: PanelDocument | null;
  setActiveDocument: React.Dispatch<React.SetStateAction<PanelDocument | null>>;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  modal: ModalState;
  setModal: (modal: ModalState) => void;
  refreshTaxonomy: () => Promise<boolean>;
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
  const [activeDocument, setActiveDocument] = useState<PanelDocument | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const selectCategory = useCallback((categoryId: string) => {
    setSelection({ categoryId });
    setActiveDocument(null);
    setIsDirty(false);
  }, []);

  const selectSubcategory = useCallback((categoryId: string, subcategoryId: string) => {
    setSelection({ categoryId, subcategoryId });
    setActiveDocument(null);
    setIsDirty(false);
  }, []);

  const selectPanel = useCallback((categoryId: string, subcategoryId: string, panelId: string) => {
    setSelection({ categoryId, subcategoryId, panelId });
    setActiveDocument(null);
    setIsDirty(false);
  }, []);

  const selectComponent = useCallback((sectionId: string, componentId: string) => {
    setSelection((prev) => ({ ...prev, sectionId, componentId }));
  }, []);

  const clearComponentSelection = useCallback(() => {
    setSelection((prev) => ({ ...prev, sectionId: undefined, componentId: undefined }));
  }, []);

  // Compute active panel object from taxonomy
  const activePanel = (selection.categoryId && selection.subcategoryId && selection.panelId && taxonomy)
    ? taxonomy
        .find((c) => c.id === selection.categoryId)
        ?.subcategories.find((s) => s.id === selection.subcategoryId)
        ?.panels.find((p) => p.id === selection.panelId) ?? null
    : null;

  return (
    <ViewsEditorContext.Provider
      value={{
        organizationId,
        taxonomy,
        loading,
        activeMode,
        setActiveMode,
        selection,
        selectCategory,
        selectSubcategory,
        selectPanel,
        selectComponent,
        clearComponentSelection,
        activePanel,
        activeDocument,
        setActiveDocument,
        isDirty,
        setIsDirty,
        modal,
        setModal,
        refreshTaxonomy,
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
