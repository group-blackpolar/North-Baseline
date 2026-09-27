import { useEffect, useRef } from 'react';
import { useViewsEditor } from './ViewsEditorContext';

const DEBOUNCE_MS = 1500;

/** Fase 5: autosave con debounce. Solo dispara `saveNow` cuando hay cambios. */
export function useViewsAutosave() {
  const { selection, activeDocument, isDirty, saveNow, saveStatus } = useViewsEditor();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!selection.panelId || !activeDocument || !isDirty) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void saveNow();
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [selection.panelId, activeDocument, isDirty, saveNow]);

  // Limpia el timer al cambiar de vista para no guardar el documento anterior.
  useEffect(() => {
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [selection.panelId]);

  return { saveStatus };
}
