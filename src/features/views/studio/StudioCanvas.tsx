import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ArrowDown, ArrowUp, Copy, DotsSixVertical, Plus, Rows, Trash } from '@phosphor-icons/react';
import { componentProps } from '@/features/admin/contentDocument';
import { IconButton } from '@/components/ui/icon-button';
import { EmptyState } from '@/components/ui/empty-state';
import { useI18n } from '@/lib/i18n';
import type { PanelDocument } from '@/lib/northAdmin';
import { cn } from '@/lib/utils';
import { useViewsEditor } from '../ViewsEditorContext';
import { ComponentPreview } from './ComponentPreview';
import { addComponent, addSection, duplicateComponent, duplicateSection, findComponent, moveSection, removeComponent, removeSection, setComponentCell, setSectionLayout, setSectionName, type Component, type Section } from './documentOps';
import { cellRect, clampCell, columnAt, growBy, nudge, resizeCell, rowAt, type Cell, type GridMetrics, type ResizeHandle } from './grid';
import { readMetrics } from './geometry';
import { DEVICE_WIDTH, definitionOf, defaultSizes, type Device } from './registry';
import type { PanelBinding } from './studioApi';
import { componentLabelKey } from './labels';

export const LIBRARY_MIME = 'application/x-north-component';
const GAP_CLASS = { none: 'gap-0', sm: 'gap-2', md: 'gap-4', lg: 'gap-6' } as const;
const HANDLES: Array<{ handle: ResizeHandle; className: string; cursor: string }> = [
  { handle: 'e', className: 'right-[-5px] top-1/2 h-8 w-2.5 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { handle: 'w', className: 'left-[-5px] top-1/2 h-8 w-2.5 -translate-y-1/2', cursor: 'cursor-ew-resize' },
  { handle: 's', className: 'bottom-[-5px] left-1/2 h-2.5 w-8 -translate-x-1/2', cursor: 'cursor-ns-resize' },
  { handle: 'se', className: 'bottom-[-6px] right-[-6px] size-3.5', cursor: 'cursor-nwse-resize' },
  { handle: 'sw', className: 'bottom-[-6px] left-[-6px] size-3.5', cursor: 'cursor-nesw-resize' },
];

// ── Ghost: the only thing that re-renders while a gesture is in progress ───────────────────────────────────────────
interface GhostState { sectionId: string; cell: Cell; kind: 'move' | 'resize' | 'drop' }
function createGhostStore() {
  let value: GhostState | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set(next: GhostState | null) {
      if (next === value) return;
      if (next && value && next.sectionId === value.sectionId && next.kind === value.kind && next.cell.x === value.cell.x && next.cell.y === value.cell.y && next.cell.w === value.cell.w && next.cell.h === value.cell.h) return;
      value = next; listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
type GhostStore = ReturnType<typeof createGhostStore>;

function GhostLayer({ store, sectionId, gridRef }: { store: GhostStore; sectionId: string; gridRef: React.RefObject<HTMLDivElement | null> }) {
  const ghost = useSyncExternalStore(store.subscribe, store.get, store.get);
  if (!ghost || ghost.sectionId !== sectionId || !gridRef.current) return null;
  const rect = cellRect(ghost.cell, readMetrics(gridRef.current));
  return <div aria-hidden="true" className="pointer-events-none absolute z-20 rounded-xl border-2 border-dashed border-accent bg-accent/10" style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }} />;
}

// ── Item ───────────────────────────────────────────────────────────────────────────────────────────────────────────
interface ItemActions {
  select: (sectionId: string, componentId: string) => void;
  pointerDown: (event: React.PointerEvent<HTMLElement>, sectionId: string, componentId: string, handle?: ResizeHandle) => void;
  pointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  pointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  keyDown: (event: React.KeyboardEvent<HTMLElement>, sectionId: string, componentId: string) => void;
  duplicate: (componentId: string) => void;
  remove: (componentId: string) => void;
}

interface ItemProps {
  organizationId: string;
  sectionId: string;
  component: Component;
  device: Device;
  selected: boolean;
  grabbed: boolean;
  tabbable: boolean;
  readOnly: boolean;
  locales: string[];
  bindings: ReadonlyArray<PanelBinding>;
  actions: ItemActions;
}

const CanvasItem = memo(function CanvasItem({ organizationId, sectionId, component, device, selected, grabbed, tabbable, readOnly, locales, bindings, actions }: ItemProps) {
  const { t } = useI18n();
  const cell = component.layout[device];
  const label = t(componentLabelKey(component.type));
  const style = { gridColumn: `${cell.x + 1} / span ${cell.w}`, gridRow: `${cell.y + 1} / span ${cell.h}` };
  return (
    <div
      data-component-id={component.id}
      role="group"
      aria-roledescription={readOnly ? undefined : t('st.canvas.item')}
      aria-label={`${label}${selected ? ` · ${t('st.canvas.selected')}` : ''}`}
      tabIndex={readOnly ? -1 : tabbable ? 0 : -1}
      style={style}
      onPointerDown={readOnly ? undefined : (event) => { if (event.button === 0 && event.pointerType === 'mouse') actions.pointerDown(event, sectionId, component.id); else actions.select(sectionId, component.id); }}
      onPointerMove={readOnly ? undefined : actions.pointerMove}
      onPointerUp={readOnly ? undefined : actions.pointerUp}
      onPointerCancel={readOnly ? undefined : actions.pointerUp}
      onClick={readOnly ? undefined : (event) => { event.stopPropagation(); actions.select(sectionId, component.id); }}
      onKeyDown={readOnly ? undefined : (event) => actions.keyDown(event, sectionId, component.id)}
      className={cn(
        'group/item relative min-w-0 rounded-xl border bg-surface p-4 outline-none transition-[border-color,box-shadow] duration-(--duration-fast)',
        readOnly ? 'border-border' : 'cursor-default border-border hover:border-border-hover focus-visible:ring-2 focus-visible:ring-accent/40',
        selected && !readOnly && 'z-10 border-accent ring-2 ring-accent/50',
        grabbed && 'ring-4 ring-accent/60',
      )}
    >
      <div className={cn(!readOnly && 'pointer-events-none select-none')}>
        <ComponentPreview organizationId={organizationId} component={component} locales={locales} bindings={bindings} live />
      </div>
      {selected && !readOnly ? (
        <>
          <div className="absolute -top-7 left-2 z-20 flex items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-0.5 shadow-soft" onPointerDown={(event) => event.stopPropagation()}>
            <span
              role="presentation"
              title={t('st.canvas.dragHandle')}
              onPointerDown={(event) => { event.stopPropagation(); actions.pointerDown(event, sectionId, component.id); }}
              className="flex cursor-grab touch-none items-center rounded px-0.5 py-0.5 text-text-muted hover:bg-surface-hover active:cursor-grabbing"
            ><DotsSixVertical className="size-4" weight="bold" aria-hidden="true" /></span>
            <span className="px-1 text-[11px] font-medium text-text-secondary">{label}</span>
            <IconButton size="icon-sm" label={t('st.canvas.duplicate')} icon={<Copy />} onClick={() => actions.duplicate(component.id)} />
            <IconButton size="icon-sm" label={t('st.canvas.remove')} icon={<Trash />} onClick={() => actions.remove(component.id)} className="hover:text-error" />
          </div>
          {HANDLES.map(({ handle, className, cursor }) => (
            <span
              key={handle}
              role="presentation"
              onPointerDown={(event) => { event.stopPropagation(); actions.pointerDown(event, sectionId, component.id, handle); }}
              className={cn('absolute z-20 touch-none rounded-full border-2 border-accent bg-surface', className, cursor)}
            />
          ))}
        </>
      ) : null}
    </div>
  );
});

// ── Section ────────────────────────────────────────────────────────────────────────────────────────────────────────
function SectionHeader({ section, index, count, selected, locale, onOpenLibrary }: { section: Section; index: number; count: number; selected: boolean; locale: string; onOpenLibrary: (sectionId: string) => void }) {
  const { t } = useI18n();
  const { edit, selectSection, getDocument, commit } = useViewsEditor();
  const name = section.name?.[locale] ?? '';
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg px-1 py-1', selected && 'bg-accent/5')}>
      <Rows className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <input
        value={name}
        onChange={(event) => edit((doc) => setSectionName(doc, section.id, locale, event.target.value), { key: `section-name:${section.id}` })}
        onFocus={() => selectSection(section.id)}
        placeholder={t('st.section.namePlaceholder', { n: index + 1 })}
        aria-label={t('st.section.name')}
        maxLength={120}
        className="h-7 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1.5 text-xs font-medium text-text outline-none placeholder:text-text-muted hover:border-border focus:border-accent"
      />
      <div className="flex items-center gap-0.5" role="group" aria-label={t('st.section.spacing')}>
        {(['none', 'sm', 'md', 'lg'] as const).map((gap) => (
          <button
            key={gap}
            type="button"
            aria-pressed={section.layout.gap === gap}
            onClick={() => edit((doc) => setSectionLayout(doc, section.id, { gap }))}
            className={cn('h-6 rounded px-1.5 text-[10px] font-medium uppercase transition-colors', section.layout.gap === gap ? 'bg-accent text-white' : 'text-text-muted hover:bg-surface-hover hover:text-text')}
          >{gap === 'none' ? '0' : gap}</button>
        ))}
      </div>
      <IconButton size="icon-sm" label={t('st.section.addComponent')} icon={<Plus />} onClick={() => onOpenLibrary(section.id)} />
      <IconButton size="icon-sm" label={t('st.section.moveUp')} icon={<ArrowUp />} disabled={index === 0} onClick={() => edit((doc) => moveSection(doc, section.id, -1))} />
      <IconButton size="icon-sm" label={t('st.section.moveDown')} icon={<ArrowDown />} disabled={index === count - 1} onClick={() => edit((doc) => moveSection(doc, section.id, 1))} />
      <IconButton size="icon-sm" label={t('st.section.duplicate')} icon={<Copy />} onClick={() => { const doc = getDocument(); const next = doc ? duplicateSection(doc, section.id) : null; if (next) commit(next.doc); }} />
      <IconButton size="icon-sm" label={t('st.section.remove')} icon={<Trash />} onClick={() => edit((doc) => removeSection(doc, section.id))} className="hover:text-error" />
    </div>
  );
}

// ── Canvas ─────────────────────────────────────────────────────────────────────────────────────────────────────────
interface Gesture {
  kind: 'move' | 'resize';
  handle?: ResizeHandle;
  componentId: string;
  sectionId: string;
  start: Cell;
  origin: { col: number; row: number };
  pointer: { x: number; y: number };
  grid: HTMLElement;
  metrics: GridMetrics;
  latest: Cell;
  moved: boolean;
  pointerId: number;
}

export function StudioCanvas({ readOnly = false, bindings, locales, onOpenLibrary, focusRequest, documentOverride }: {
  readOnly?: boolean;
  /** Render another document (the published version) instead of the editing draft. Read-only use only. */
  documentOverride?: PanelDocument;
  bindings: ReadonlyArray<PanelBinding>;
  locales: string[];
  onOpenLibrary: (sectionId: string | null) => void;
  /** Incremented by the editor after a component is added so the canvas focuses and reveals it. */
  focusRequest: { id: string; n: number } | null;
}) {
  const { t, locale } = useI18n();
  const ctx = useViewsEditor();
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const { selection, device, organizationId } = ctx;
  const activeDocument = documentOverride ?? ctx.activeDocument;
  const [grabbedId, setGrabbedId] = useState<string | null>(null);
  const grabbedRef = useRef<string | null>(null);
  grabbedRef.current = grabbedId;
  const [announcement, setAnnouncement] = useState('');
  const ghost = useMemo(createGhostStore, []);
  const gesture = useRef<Gesture | null>(null);
  const gridRefs = useRef(new Map<string, HTMLDivElement>());
  const frameRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(t);
  tRef.current = t;

  const pointToCell = useCallback((grid: HTMLElement, metrics: GridMetrics, clientX: number, clientY: number) => {
    const rect = grid.getBoundingClientRect();
    return { col: columnAt(clientX - rect.left, metrics.width, metrics.gap), row: rowAt(clientY - rect.top, metrics.tracks, metrics.gap) };
  }, []);

  const actions = useMemo<ItemActions>(() => {
    const endGesture = (event?: React.PointerEvent<HTMLElement>) => {
      const current = gesture.current;
      gesture.current = null;
      ghost.set(null);
      if (event && current) { try { (event.currentTarget as HTMLElement).releasePointerCapture(current.pointerId); } catch { /* already released */ } }
      return current;
    };
    return {
      select: (sectionId, componentId) => ctxRef.current.selectComponent(sectionId, componentId),
      pointerDown: (event, sectionId, componentId, handle) => {
        const { selectComponent, device: dev, getDocument } = ctxRef.current;
        selectComponent(sectionId, componentId);
        const doc = getDocument();
        const found = doc ? findComponent(doc, componentId) : null;
        const grid = gridRefs.current.get(sectionId);
        if (!found || !grid) return;
        const metrics = readMetrics(grid);
        const start = found.component.layout[dev];
        const origin = pointToCell(grid, metrics, event.clientX, event.clientY);
        gesture.current = { kind: handle ? 'resize' : 'move', handle, componentId, sectionId, start, origin, pointer: { x: event.clientX, y: event.clientY }, grid, metrics, latest: start, moved: false, pointerId: event.pointerId };
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      },
      pointerMove: (event) => {
        const g = gesture.current;
        if (!g) return;
        if (!g.moved && Math.hypot(event.clientX - g.pointer.x, event.clientY - g.pointer.y) < 4) return;
        g.moved = true;
        const now = pointToCell(g.grid, g.metrics, event.clientX, event.clientY);
        const dCols = now.col - g.origin.col;
        const dRows = now.row - g.origin.row;
        const target = g.kind === 'move' ? clampCell({ ...g.start, x: g.start.x + dCols, y: g.start.y + dRows }) : resizeCell(g.start, g.handle!, dCols, dRows);
        g.latest = target;
        ghost.set({ sectionId: g.sectionId, cell: target, kind: g.kind });
      },
      pointerUp: (event) => {
        const g = endGesture(event);
        if (!g || !g.moved) return;
        const { edit, device: dev } = ctxRef.current;
        edit((doc) => setComponentCell(doc, g.componentId, dev, g.latest));
      },
      keyDown: (event, sectionId, componentId) => {
        if (event.target !== event.currentTarget) return; // typing inside a child control is never a canvas command
        const { edit, device: dev, getDocument, commit, clearComponentSelection, selectComponent } = ctxRef.current;
        const doc = getDocument();
        const found = doc ? findComponent(doc, componentId) : null;
        if (!doc || !found) return;
        const mod = event.ctrlKey || event.metaKey;
        const arrow = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key as 'ArrowLeft'];
        const label = tRef.current(componentLabelKey(found.component.type));
        if (grabbedRef.current === componentId) {
          if (arrow) {
            event.preventDefault();
            const cell = found.component.layout[dev];
            const next = event.shiftKey ? growBy(cell, arrow[0]!, arrow[1]!) : nudge(cell, arrow[0]!, arrow[1]!);
            edit((current) => setComponentCell(current, componentId, dev, next), { key: `kbd:${componentId}` });
            setAnnouncement(tRef.current('st.canvas.positionAnnounce', { x: next.x + 1, y: next.y + 1, w: next.w, h: next.h }));
          } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Escape') {
            event.preventDefault();
            setGrabbedId(null);
            setAnnouncement(tRef.current('st.canvas.dropped', { name: label }));
          }
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setGrabbedId(componentId); setAnnouncement(tRef.current('st.canvas.grabbed', { name: label })); return; }
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); commit(removeComponent(doc, componentId)); setAnnouncement(tRef.current('st.canvas.removed', { name: label })); return; }
        if (mod && event.key.toLowerCase() === 'd') {
          event.preventDefault();
          const copy = duplicateComponent(doc, componentId);
          if (copy) { commit(copy.doc); selectComponent(sectionId, copy.componentId); }
          return;
        }
        if (event.key === 'Escape') { event.preventDefault(); clearComponentSelection(); return; }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          const order = doc.sections.flatMap((section) => section.components.map((item) => ({ id: item.id, sectionId: section.id })));
          const index = order.findIndex((item) => item.id === componentId);
          const target = order[index + (event.key === 'ArrowDown' ? 1 : -1)];
          if (target) { selectComponent(target.sectionId, target.id); frameRef.current?.querySelector<HTMLElement>(`[data-component-id="${CSS.escape(target.id)}"]`)?.focus(); }
        }
      },
      duplicate: (componentId) => {
        const { getDocument, commit, selectComponent } = ctxRef.current;
        const doc = getDocument();
        const copy = doc ? duplicateComponent(doc, componentId) : null;
        if (copy) { commit(copy.doc); const found = findComponent(copy.doc, copy.componentId); if (found) selectComponent(found.section.id, copy.componentId); }
      },
      remove: (componentId) => { const { getDocument, commit } = ctxRef.current; const doc = getDocument(); if (doc) commit(removeComponent(doc, componentId)); },
    };
  }, [ghost, pointToCell]);

  // Escape cancels a pointer gesture without committing it.
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { gesture.current = null; ghost.set(null); } };
    window.addEventListener('keydown', cancel);
    return () => window.removeEventListener('keydown', cancel);
  }, [ghost]);

  // Focus + reveal a freshly added component.
  useEffect(() => {
    if (!focusRequest) return;
    const element = frameRef.current?.querySelector<HTMLElement>(`[data-component-id="${CSS.escape(focusRequest.id)}"]`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [focusRequest]);
  useEffect(() => { if (grabbedId && grabbedId !== selection.componentId) setGrabbedId(null); }, [grabbedId, selection.componentId]);

  // ── Library drag & drop (pointer-free alternative: the library's "Add" buttons) ──
  const onDragOver = (event: React.DragEvent<HTMLElement>, section: Section) => {
    if (readOnly || !event.dataTransfer.types.includes(LIBRARY_MIME)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const grid = gridRefs.current.get(section.id);
    if (!grid) return;
    const metrics = readMetrics(grid);
    const at = pointToCell(grid, metrics, event.clientX, event.clientY);
    // The dragged type is not readable during dragover (browser security); a one-cell preview marks the drop origin.
    ghost.set({ sectionId: section.id, cell: clampCell({ x: at.col, y: at.row, w: 3, h: 2 }), kind: 'drop' });
  };
  const onDrop = (event: React.DragEvent<HTMLElement>, section: Section) => {
    const type = event.dataTransfer.getData(LIBRARY_MIME);
    ghost.set(null);
    if (readOnly || !type || !definitionOf(type)?.addable) return;
    event.preventDefault();
    const grid = gridRefs.current.get(section.id);
    const { getDocument, commit, selectComponent, device: dev } = ctxRef.current;
    const doc = getDocument();
    if (!doc || !grid) return;
    const added = addComponent(doc, section.id, { type, props: componentProps(type as never) });
    if (!added) return;
    const at = pointToCell(grid, readMetrics(grid), event.clientX, event.clientY);
    const size = defaultSizes(type)[dev];
    commit(setComponentCell(added.doc, added.componentId, dev, clampCell({ x: at.col, y: at.row, w: size.w, h: size.h })));
    selectComponent(section.id, added.componentId);
    setAnnouncement(tRef.current('st.canvas.added', { name: tRef.current(componentLabelKey(type)) }));
  };

  if (!activeDocument) return null;
  const sections = activeDocument.sections;
  const width = DEVICE_WIDTH[device];
  const firstId = sections.flatMap((section) => section.components)[0]?.id;

  return (
    <div
      className="min-h-0 flex-1 overflow-auto bg-surface-hover/40 p-4"
      onClick={() => { if (!readOnly) ctx.clearComponentSelection(); }}
    >
      <div
        ref={frameRef}
        data-device={device}
        className={cn('mx-auto space-y-6 transition-[max-width] duration-(--duration-base)', width ? 'rounded-2xl border border-border bg-background p-4 shadow-soft' : 'max-w-[1680px]')}
        style={width ? { maxWidth: width } : undefined}
      >
        {sections.length === 0 ? (
          <EmptyState
            icon={Rows}
            title={t('st.canvas.emptyTitle')}
            body={t('st.canvas.emptyBody')}
            action={!readOnly ? <button type="button" onClick={(event) => { event.stopPropagation(); onOpenLibrary(null); }} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-hover"><Plus className="size-4" />{t('st.library.title')}</button> : undefined}
          />
        ) : null}
        {sections.map((section, index) => (
          <SectionBlock
            key={section.id}
            section={section}
            index={index}
            count={sections.length}
            readOnly={readOnly}
            device={device}
            selected={selection.sectionId === section.id && !selection.componentId}
            locale={locale}
            organizationId={organizationId}
            locales={locales}
            bindings={bindings}
            selectedId={selection.componentId}
            grabbedId={grabbedId}
            firstId={selection.componentId ? undefined : firstId}
            ghost={ghost}
            actions={actions}
            registerGrid={(element) => { if (element) gridRefs.current.set(section.id, element); else gridRefs.current.delete(section.id); }}
            onOpenLibrary={onOpenLibrary}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onDragLeave={() => ghost.set(null)}
            onSelectSection={() => ctx.selectSection(section.id)}
          />
        ))}
        {!readOnly && sections.length > 0 ? (
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); const doc = ctx.getDocument(); const next = doc ? addSection(doc) : null; if (next) { ctx.commit(next.doc); ctx.selectSection(next.sectionId); } }}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-xs font-medium text-text-muted transition-colors hover:border-accent hover:text-accent"
          ><Plus className="size-4" />{t('st.section.add')}</button>
        ) : null}
      </div>
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}

function SectionBlock({ section, index, count, readOnly, device, selected, locale, organizationId, locales, bindings, selectedId, grabbedId, firstId, ghost, actions, registerGrid, onOpenLibrary, onDragOver, onDrop, onDragLeave, onSelectSection }: {
  section: Section; index: number; count: number; readOnly: boolean; device: Device; selected: boolean; locale: string; organizationId: string; locales: string[];
  bindings: ReadonlyArray<PanelBinding>; selectedId: string | undefined; grabbedId: string | null; firstId: string | undefined; ghost: GhostStore; actions: ItemActions;
  registerGrid: (element: HTMLDivElement | null) => void; onOpenLibrary: (sectionId: string | null) => void;
  onDragOver: (event: React.DragEvent<HTMLElement>, section: Section) => void; onDrop: (event: React.DragEvent<HTMLElement>, section: Section) => void; onDragLeave: () => void; onSelectSection: () => void;
}) {
  const { t } = useI18n();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const setRef = useCallback((element: HTMLDivElement | null) => { gridRef.current = element; registerGrid(element); }, [registerGrid]);
  return (
    <section
      aria-label={section.name?.[locale] || t('st.section.namePlaceholder', { n: index + 1 })}
      onClick={(event) => { event.stopPropagation(); if (!readOnly) onSelectSection(); }}
      onDragOver={readOnly ? undefined : (event) => onDragOver(event, section)}
      onDrop={readOnly ? undefined : (event) => onDrop(event, section)}
      onDragLeave={readOnly ? undefined : onDragLeave}
      className={cn('space-y-2 rounded-2xl', !readOnly && 'border border-dashed p-3 transition-colors', !readOnly && (selected ? 'border-accent/60' : 'border-border/70'))}
    >
      {!readOnly ? <SectionHeader section={section} index={index} count={count} selected={selected} locale={locale} onOpenLibrary={onOpenLibrary} /> : null}
      <div className={cn('relative', !readOnly && 'pt-6')}>
        <div ref={setRef} className={cn('grid grid-cols-12 auto-rows-[minmax(2rem,auto)]', GAP_CLASS[section.layout.gap], !readOnly && section.components.length === 0 && 'min-h-24')}>
          {section.components.map((component) => (
            <CanvasItem
              key={component.id}
              organizationId={organizationId}
              sectionId={section.id}
              component={component}
              device={device}
              selected={selectedId === component.id}
              grabbed={grabbedId === component.id}
              tabbable={selectedId === component.id || firstId === component.id}
              readOnly={readOnly}
              locales={locales}
              bindings={bindings}
              actions={actions}
            />
          ))}
        </div>
        {!readOnly && section.components.length === 0 ? (
          <button type="button" onClick={(event) => { event.stopPropagation(); onOpenLibrary(section.id); }} className="absolute inset-0 flex items-center justify-center gap-1.5 rounded-xl text-xs text-text-muted hover:text-accent">
            <Plus className="size-4" />{t('st.section.emptyHint')}
          </button>
        ) : null}
        <GhostLayer store={ghost} sectionId={section.id} gridRef={gridRef} />
      </div>
    </section>
  );
}
