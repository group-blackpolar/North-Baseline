/* oxlint-disable react/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  VIEW_CATALOG,
  firstSubcategoryId,
  subcategoryLabel,
  viewLabel,
  type ViewId,
} from '@/lib/navigation';

export interface TabRoute {
  categoryId: ViewId;
  subcategoryId: string | null;
}

export interface Tab {
  id: string;
  viewId: ViewId; // === route.categoryId, compat con ViewRenderer
  route: TabRoute;
  params?: Record<string, unknown>;
  isPersistent: boolean;
}

interface TabsContextValue {
  tabs: Tab[];
  activeTab: Tab | null;
  navigate: (categoryId: ViewId, subcategoryId?: string | null) => void;
  openNewTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);
const STORAGE_KEY = 'north-open-tabs-v2';

function defaultRoute(): TabRoute {
  const categoryId = VIEW_CATALOG[0]?.id ?? 'dashboards';
  return { categoryId, subcategoryId: firstSubcategoryId(categoryId) };
}

function createTab(route: TabRoute): Tab {
  return { id: crypto.randomUUID(), viewId: route.categoryId, route, isPersistent: true };
}

/** Migra tabs persistidas en formatos anteriores */
function sanitizeTabs(raw: unknown): Tab[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw
    .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null)
    .map((t) => {
      const categoryId = (typeof t.viewId === 'string' && VIEW_CATALOG.some((v) => v.id === t.viewId)
        ? t.viewId
        : null) as ViewId | null;
      if (!categoryId) return null;
      const route = (t.route as TabRoute | undefined) ?? {
        categoryId,
        subcategoryId: firstSubcategoryId(categoryId),
      };
      return createTab({ categoryId: route.categoryId ?? categoryId, subcategoryId: route.subcategoryId ?? null });
    })
    .filter((t): t is Tab => t !== null);
  return valid;
}

export function tabTitle(tab: Tab): string {
  return subcategoryLabel(tab.route.categoryId, tab.route.subcategoryId) ?? viewLabel(tab.route.categoryId);
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const stored = sanitizeTabs(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'));
      return stored.length > 0 ? stored : [createTab(defaultRoute())];
    } catch {
      return [createTab(defaultRoute())];
    }
  });
  const [activeId, setActiveId] = useState<string>(() => tabs[0]?.id ?? '');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0] ?? null;

  /** Navegar = mutar la ruta de la tab activa. Nunca crea tabs. */
  const navigate = useCallback((categoryId: ViewId, subcategoryId?: string | null) => {
    setTabs((prev) => {
      const current = prev.find((t) => t.id === activeId) ?? prev[0];
      if (!current) return prev;
      const nextSub =
        subcategoryId === undefined
          ? current.route.categoryId === categoryId
            ? current.route.subcategoryId
            : firstSubcategoryId(categoryId)
          : subcategoryId;
      return prev.map((t) =>
        t.id === current.id
          ? { ...t, viewId: categoryId, route: { categoryId, subcategoryId: nextSub } }
          : t
      );
    });
  }, [activeId]);

  const openNewTab = useCallback(() => {
    setTabs((prev) => {
      const current = prev.find((t) => t.id === activeId) ?? prev[0];
      const categoryId = current?.route.categoryId ?? VIEW_CATALOG[0].id;
      const tab = createTab({ categoryId, subcategoryId: firstSubcategoryId(categoryId) });
      setActiveId(tab.id);
      return [...prev, tab];
    });
  }, [activeId]);

  const closeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const index = prev.findIndex((t) => t.id === tabId);
      if (index === -1) return prev;
      const next = prev.filter((t) => t.id !== tabId);
      if (next.length === 0) {
        // Nunca dejar el shell sin tabs
        const fallback = createTab(defaultRoute());
        setActiveId(fallback.id);
        return [fallback];
      }
      setActiveId((currentActive) => {
        if (currentActive !== tabId) return currentActive;
        return (next[index] ?? next[index - 1] ?? next[0]).id;
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