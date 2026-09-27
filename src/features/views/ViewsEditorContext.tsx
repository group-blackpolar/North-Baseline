import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { ComponentType, ManagementCategory, TaxonomyPanel, PanelDocument } from '@/lib/northAdmin';
import { componentProps } from '@/features/admin/contentDocument';
import { newId } from '@/features/admin/contentDocument';

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
  | { type: 'component_library'; sectionId: string | null }
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
  selectSection: (sectionId: string) => void;
  clearComponentSelection: () => void;
  activePanel: TaxonomyPanel | null;
  activeDocument: PanelDocument | null;
  setActiveDocument: React.Dispatch<React.SetStateAction<PanelDocument | null>>;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  modal: ModalState;
  setModal: (modal: ModalState) => void;
  refreshTaxonomy: () => Promise<boolean>;
  // Fase 3: document mutations (draft state only, no backend writes)
  touchDocument: (updater: (doc: PanelDocument) => PanelDocument) => void;
  updateComponentProps: (sectionId: string, componentId: string, props: Record<string, unknown>) => void;
  addComponentToSection: (sectionId: string | null, type: import('@/lib/northAdmin').ComponentType) => void;
  addSection: () => void;
  removeComponent: (sectionId: string, componentId: string) => void;
  removeSection: (sectionId: string) => void;
  moveComponent: (sectionId: string, componentId: string, direction: -1 | 1) => void;
  duplicateComponent: (sectionId: string, componentId: string) => void;
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

  const selectSection = useCallback((sectionId: string) => {
    setSelection((prev) => ({ ...prev, sectionId, componentId: undefined }));
  }, []);

  const clearComponentSelection = useCallback(() => {
    setSelection((prev) => ({ ...prev, sectionId: undefined, componentId: undefined }));
  }, []);

  const touchDocument = useCallback((updater: (doc: PanelDocument) => PanelDocument) => {
    setActiveDocument((prev) => {
      if (!prev) return prev;
      return updater(prev);
    });
    setIsDirty(true);
  }, []);

  const updateComponentProps = useCallback(
    (sectionId: string, componentId: string, props: Record<string, unknown>) => {
      touchDocument((doc) => ({
        ...doc,
        sections: doc.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                components: section.components.map((comp) =>
                  comp.id !== componentId ? comp : { ...comp, props: { ...comp.props, ...props } },
                ),
              },
        ),
      }));
    },
    [touchDocument],
  );

  const addComponentToSection = useCallback(
    (sectionId: string | null, type: ComponentType) => {
      const component = {
        id: newId(),
        type,
        schemaVersion: 1 as const,
        props: componentProps(type),
        bindings: {},
        layout: {
          desktop: { x: 0, y: 0, w: 12, h: 2 },
          tablet: { x: 0, y: 0, w: 12, h: 2 },
          mobile: { x: 0, y: 0, w: 12, h: 2 },
        },
        order: 0,
      };
      touchDocument((doc) => {
        const targetId = sectionId ?? doc.sections[0]?.id;
        // Sin secciones: crear la primera.
        if (!targetId) {
          return {
            ...doc,
            sections: [
              {
                id: newId(),
                order: 0,
                layout: { variant: 'grid' as const, gap: 'md' as const },
                components: [{ ...component, order: 0 }],
              },
            ],
          };
        }
        return {
          ...doc,
          sections: doc.sections.map((section) =>
            section.id !== targetId
              ? section
              : {
                  ...section,
                  components: [...section.components, { ...component, order: section.components.length }].map(
                    (item, index) => ({ ...item, order: index }),
                  ),
                },
          ),
        };
      });
      setModal(null);
    },
    [touchDocument],
  );

  const addSection = useCallback(() => {
    touchDocument((doc) => ({
      ...doc,
      sections: [
        ...doc.sections,
        {
          id: newId(),
          order: doc.sections.length,
          layout: { variant: 'grid' as const, gap: 'md' as const },
          components: [],
        },
      ],
    }));
  }, [touchDocument]);

  const removeComponent = useCallback(
    (sectionId: string, componentId: string) => {
      touchDocument((doc) => ({
        ...doc,
        sections: doc.sections.map((section) =>
          section.id !== sectionId
            ? section
            : {
                ...section,
                components: section.components
                  .filter((comp) => comp.id !== componentId)
                  .map((item, index) => ({ ...item, order: index })),
              },
        ),
      }));
      setSelection((prev) =>
        prev.componentId === componentId ? { ...prev, componentId: undefined } : prev,
      );
    },
    [touchDocument],
  );

  const removeSection = useCallback(
    (sectionId: string) => {
      touchDocument((doc) => ({
        ...doc,
        sections: doc.sections
          .filter((section) => section.id !== sectionId)
          .map((section, index) => ({ ...section, order: index })),
      }));
      setSelection((prev) => ({ ...prev, sectionId: undefined, componentId: undefined }));
    },
    [touchDocument],
  );

  const moveComponent = useCallback(
    (sectionId: string, componentId: string, direction: -1 | 1) => {
      touchDocument((doc) => ({
        ...doc,
        sections: doc.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const index = section.components.findIndex((comp) => comp.id === componentId);
          const target = index + direction;
          if (index < 0 || target < 0 || target >= section.components.length) return section;
          const next = [...section.components];
          const [moved] = next.splice(index, 1);
          next.splice(target, 0, moved);
          return { ...section, components: next.map((item, order) => ({ ...item, order })) };
        }),
      }));
    },
    [touchDocument],
  );

  const duplicateComponent = useCallback(
    (sectionId: string, componentId: string) => {
      touchDocument((doc) => ({
        ...doc,
        sections: doc.sections.map((section) => {
          if (section.id !== sectionId) return section;
          const index = section.components.findIndex((comp) => comp.id === componentId);
          if (index < 0) return section;
          const source = section.components[index];
          const copy = { ...source, id: newId(), props: JSON.parse(JSON.stringify(source.props)) as Record<string, unknown> };
          const next = [...section.components];
          next.splice(index + 1, 0, copy);
          return { ...section, components: next.map((item, order) => ({ ...item, order })) };
        }),
      }));
    },
    [touchDocument],
  );

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
        selectSection,
        clearComponentSelection,
        activePanel,
        activeDocument,
        setActiveDocument,
        isDirty,
        setIsDirty,
        modal,
        setModal,
        refreshTaxonomy,
        touchDocument,
        updateComponentProps,
        addComponentToSection,
        addSection,
        removeComponent,
        removeSection,
        moveComponent,
        duplicateComponent,
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
