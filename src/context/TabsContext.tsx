/* oxlint-disable react/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { uuid } from '@/lib/utils';
import { loadNavState, saveNavState } from '@/lib/navState';

export interface TabRoute {
  categoryId: string;
  subcategoryId: string | null;
}

export interface PublishedPanelTab {
  id: string;
  title: string;
  document: import('@/lib/organizations').PublishedPanelDocument | null;
  localeOrder: string[];
}

export interface Tab {
  id: string;
  route: TabRoute;
  publishedPanel?: PublishedPanelTab;
  /** A restored tab whose published panel still has to be resolved (documents are never persisted). */
  restorePanelId?: string;
}

interface TabsContextValue {
  tabs: Tab[];
  activeTab: Tab | null;
  navigate: (categoryId: string, subcategoryId?: string | null, publishedPanel?: PublishedPanelTab) => void;
  openNewTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  /** Attaches a resolved published panel to a restored tab without changing which tab is active. */
  hydratePanel: (tabId: string, panel: PublishedPanelTab) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsState { tabs: Tab[]; activeId: string }

function initialState(persistKey: string | null | undefined): TabsState {
  const restored = loadNavState(persistKey ?? null);
  if (!restored) return { tabs: [], activeId: '' };
  return {
    activeId: restored.activeId,
    tabs: restored.tabs.map((tab) => ({ id: tab.id, route: { categoryId: tab.categoryId, subcategoryId: tab.subcategoryId }, ...(tab.panelId ? { restorePanelId: tab.panelId } : {}) })),
  };
}

export function TabsProvider({ children, persistKey }: { children: ReactNode; persistKey?: string | null }) {
  const [state, setState] = useState<TabsState>(() => initialState(persistKey));
  const { tabs, activeId } = state;

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  // Reload / discarded page / restored browser tab: remember where the person was (ids only).
  useEffect(() => {
    saveNavState(persistKey ?? null, {
      activeId: activeTab?.id ?? '',
      tabs: tabs.map((tab) => ({ id: tab.id, categoryId: tab.route.categoryId, subcategoryId: tab.route.subcategoryId, ...((tab.publishedPanel?.id ?? tab.restorePanelId) ? { panelId: (tab.publishedPanel?.id ?? tab.restorePanelId)! } : {}) })),
    });
  }, [activeTab?.id, persistKey, tabs]);

  /** Navegar = mutar la ruta de la tab activa, o crear una nueva si no hay tabs.
   *  Stable identity (no dependency on the active tab) so effects that call it do not re-run on every tab change. */
  const navigate = useCallback((categoryId: string, subcategoryId?: string | null, publishedPanel?: PublishedPanelTab) => {
    setState((prev) => {
      const route = { categoryId, subcategoryId: subcategoryId ?? null };
      const current = prev.tabs.find((t) => t.id === prev.activeId) ?? prev.tabs[0];
      if (!current) {
        const newTab: Tab = { id: uuid(), route, publishedPanel };
        return { tabs: [newTab], activeId: newTab.id };
      }
      return { ...prev, tabs: prev.tabs.map((t) => (t.id === current.id ? { id: t.id, route, publishedPanel } : t)), activeId: current.id };
    });
  }, []);

  const openNewTab = useCallback(() => {
    setState((prev) => {
      const current = prev.tabs.find((t) => t.id === prev.activeId) ?? prev.tabs[0];
      const newTab: Tab = { id: uuid(), route: { categoryId: current?.route.categoryId ?? 'home', subcategoryId: null } };
      return { tabs: [...prev.tabs, newTab], activeId: newTab.id };
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setState((prev) => {
      const index = prev.tabs.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;
      const next = prev.tabs.filter((t) => t.id !== tabId);
      const activeId = prev.activeId !== tabId ? prev.activeId : (next[index] ?? next[index - 1] ?? next[0])?.id ?? '';
      return { tabs: next, activeId };
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setState((prev) => (prev.activeId === tabId ? prev : { ...prev, activeId: tabId }));
  }, []);

  const hydratePanel = useCallback((tabId: string, panel: PublishedPanelTab) => {
    setState((prev) => ({ ...prev, tabs: prev.tabs.map((t) => (t.id === tabId && !t.publishedPanel ? { id: t.id, route: t.route, publishedPanel: panel } : t)) }));
  }, []);

  const value = useMemo(
    () => ({ tabs, activeTab, navigate, openNewTab, closeTab, setActiveTab, hydratePanel }),
    [tabs, activeTab, navigate, openNewTab, closeTab, setActiveTab, hydratePanel],
  );

  return <TabsContext.Provider value={value}>{children}</TabsContext.Provider>;
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('useTabs must be used within TabsProvider');
  return context;
}
