/* oxlint-disable react/only-export-components */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface TabRoute {
  categoryId: string;
  subcategoryId: string | null;
}

export interface Tab {
  id: string;
  route: TabRoute;
}

interface TabsContextValue {
  tabs: Tab[];
  activeTab: Tab | null;
  navigate: (categoryId: string, subcategoryId?: string | null) => void;
  openNewTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  /** Navegar = mutar la ruta de la tab activa, o crear una nueva si no hay tabs. */
  const navigate = useCallback((categoryId: string, subcategoryId?: string | null) => {
    setTabs((prev) => {
      const current = prev.find((t) => t.id === activeId) ?? prev[0];
      if (!current) {
        // No hay tabs: crear una nueva
        const newTab: Tab = {
          id: crypto.randomUUID(),
          route: { categoryId, subcategoryId: subcategoryId ?? null },
        };
        setActiveId(newTab.id);
        return [newTab];
      }
      // Mutar la tab activa
      return prev.map((t) =>
        t.id === current.id
          ? { ...t, route: { categoryId, subcategoryId: subcategoryId ?? null } }
          : t
      );
    });
  }, [activeId]);

  const openNewTab = useCallback(() => {
    setTabs((prev) => {
      const current = prev.find((t) => t.id === activeId) ?? prev[0];
      const categoryId = current?.route.categoryId ?? 'home';
      const newTab: Tab = {
        id: crypto.randomUUID(),
        route: { categoryId, subcategoryId: null },
      };
      setActiveId(newTab.id);
      return [...prev, newTab];
    });
  }, [activeId]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      setActiveId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        return (next[index] ?? next[index - 1] ?? next[0] ?? null)?.id ?? '';
      });
      return next;
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveId(tabId);
  }, []);

  return (
    <TabsContext.Provider value={{ tabs, activeTab, navigate, openNewTab, closeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) throw new Error('useTabs must be used within TabsProvider');
  return context;
}