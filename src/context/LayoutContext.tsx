/* oxlint-disable react/only-export-components */
import { createContext, useContext, useRef, useState, useCallback, type ReactNode } from 'react';

export type LayoutMode = 'single' | 'right' | 'left' | 'bottom' | 'grid';

export const PANE_MIN = 240;
export const PANE_MAX = 760;

interface LayoutContextValue {
  mode: LayoutMode;
  setMode: (mode: LayoutMode) => void;
  paneSize: number;
  setPaneSize: (px: number) => void;
  commitPaneSize: () => void;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  paneTabId: Record<number, string | null>;
  setPaneTabId: (pane: number, tabId: string | null) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);
const STORAGE_KEY = 'north-layout-v2';

function clampPane(px: number, axis: 'x' | 'y'): number {
  const viewportLimit = axis === 'x' ? window.innerWidth * 0.6 : window.innerHeight * 0.7;
  return Math.round(Math.min(Math.max(px, PANE_MIN), Math.min(PANE_MAX, viewportLimit)));
}

function readStored(): { mode: LayoutMode; paneSize: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (raw && typeof raw.paneSize === 'number') {
      return { mode: (raw.mode as LayoutMode) ?? 'single', paneSize: raw.paneSize };
    }
  } catch {
    /* storage no disponible */
  }
  return { mode: 'single', paneSize: 380 };
}

export function LayoutProvider({ children }: { children: ReactNode }) {
  const [{ mode: initialMode, paneSize: initialSize }] = useState(readStored);
  const [mode, setModeState] = useState<LayoutMode>(initialMode);
  const [paneSize, setPaneSizeState] = useState(initialSize);
  const [dragging, setDragging] = useState(false);
  const [paneTabId, setPaneTabIdState] = useState<Record<number, string | null>>({});
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const setMode = useCallback((next: LayoutMode) => {
    setModeState(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: next, paneSize: readStored().paneSize }));
  }, []);

  const setPaneSize = useCallback((px: number) => {
    setPaneSizeState(clampPane(px, 'x'));
  }, []);

  const commitPaneSize = useCallback(() => {
    setPaneSizeState((current) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: modeRef.current, paneSize: current }));
      return current;
    });
  }, []);

  const setPaneTabId = useCallback((pane: number, tabId: string | null) => {
    setPaneTabIdState((prev) => ({ ...prev, [pane]: tabId }));
  }, []);

  return (
    <LayoutContext.Provider
      value={{ mode, setMode, paneSize, setPaneSize, commitPaneSize, dragging, setDragging, paneTabId, setPaneTabId }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (!context) throw new Error('useLayout must be used within LayoutProvider');
  return context;
}