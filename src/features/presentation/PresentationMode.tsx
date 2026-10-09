import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowsOut, CaretLeft, CaretRight, Pause, Play, X } from '@phosphor-icons/react';
import { portalContainer } from '@/components/ui/portal';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export type PresentationScene = { id: string; title: string; content: ReactNode };

const AUTOPLAY_MS = 15_000;

/**
 * Meeting presentation of a published panel: one scene per section on a 16:9 stage, keyboard navigation, the panel
 * title, a read-only snapshot of the filters in force and the time the data was last refreshed. It only re-renders
 * content the person is already authorized to see; closing it returns to the untouched dashboard (the dashboard's own
 * filter state lives outside this component and is never modified here).
 */
export function PresentationMode({ title, scenes, filterSummary, updatedAt, onExit }: {
  title: string;
  scenes: PresentationScene[];
  /** Human-readable snapshot of the filters in force when the presentation started. */
  filterSummary: string[];
  updatedAt: string | null;
  onExit: () => void;
}) {
  const { t, locale } = useI18n();
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const last = scenes.length - 1;

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(last, next))), [last]);
  const toggleFullscreen = useCallback(() => {
    const root = rootRef.current;
    if (!root || !document.fullscreenEnabled) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void root.requestFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    rootRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { if (!document.fullscreenElement) onExit(); return; }
      if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') { event.preventDefault(); setIndex((value) => Math.min(last, value + 1)); }
      else if (event.key === 'ArrowLeft' || event.key === 'PageUp') { event.preventDefault(); setIndex((value) => Math.max(0, value - 1)); }
      else if (event.key === 'Home') go(0);
      else if (event.key === 'End') go(last);
      else if (event.key.toLowerCase() === 'f') toggleFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (document.fullscreenElement && rootRef.current?.contains(document.fullscreenElement)) void document.exitFullscreen().catch(() => {});
    };
  }, [go, last, onExit, toggleFullscreen]);

  useEffect(() => {
    if (!autoplay || last < 1) return;
    const timer = window.setTimeout(() => setIndex((value) => (value >= last ? 0 : value + 1)), AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [autoplay, index, last]);

  const scene = scenes[index];
  const container = portalContainer() ?? document.body;
  const button = 'grid size-9 place-items-center rounded-full text-text-secondary transition-colors duration-(--duration-fast) hover:bg-surface-hover hover:text-text disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40';

  return createPortal(
    <div ref={rootRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-(--z-modal) flex flex-col bg-background text-text outline-none">
      <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-2 pt-4">
        <div className="min-w-0">
          <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            <span className="font-medium">{t('pres.filters')}:</span> {filterSummary.length ? filterSummary.join(' · ') : t('pres.noFilters')}
            {updatedAt ? <> · <span className="font-medium">{t('pres.updated')}:</span> <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}</time></> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {document.fullscreenEnabled ? <button type="button" className={button} onClick={toggleFullscreen} title={t('pres.fullscreen')} aria-label={t('pres.fullscreen')}><ArrowsOut className="size-4" /></button> : null}
          <button type="button" className={button} onClick={onExit} title={t('pres.exit')} aria-label={t('pres.exit')}><X className="size-4" /></button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-6 pb-2">
        {scene ? (
          <section
            aria-roledescription="slide"
            aria-label={t('pres.slide', { n: index + 1, total: scenes.length })}
            className="relative aspect-video max-h-full max-w-full overflow-auto rounded-2xl border border-border bg-surface p-6 shadow-soft"
            style={{ width: 'min(100%, calc((100vh - 9rem) * 16 / 9))' }}
          >
            <div aria-live="polite" className="sr-only">{scene.title}</div>
            {scene.content}
          </section>
        ) : <p className="text-sm text-text-muted">{t('pres.empty')}</p>}
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-4 px-6 pb-4 pt-1">
        <p className="hidden text-[11px] text-text-muted sm:block">{t('pres.hint')}</p>
        <div className="mx-auto flex items-center gap-1 sm:mx-0">
          <button type="button" className={button} onClick={() => go(index - 1)} disabled={index === 0} title={t('pres.prev')} aria-label={t('pres.prev')}><CaretLeft className="size-4" /></button>
          <ol className="flex items-center gap-1.5 px-1" aria-label={t('pres.slide', { n: index + 1, total: scenes.length })}>
            {scenes.map((item, position) => (
              <li key={item.id}>
                <button type="button" onClick={() => go(position)} aria-label={t('pres.goTo', { n: position + 1 })} aria-current={position === index ? 'step' : undefined} className={cn('block h-2 rounded-full transition-all duration-(--duration-fast) motion-reduce:transition-none', position === index ? 'w-6 bg-accent' : 'w-2 bg-border-strong hover:bg-text-muted')} />
              </li>
            ))}
          </ol>
          <button type="button" className={button} onClick={() => go(index + 1)} disabled={index === last} title={t('pres.next')} aria-label={t('pres.next')}><CaretRight className="size-4" /></button>
          {last > 0 ? <button type="button" className={cn(button, autoplay && 'bg-accent-soft text-accent')} onClick={() => setAutoplay((value) => !value)} aria-pressed={autoplay} title={t('pres.autoplay')} aria-label={t('pres.autoplay')}>{autoplay ? <Pause className="size-4" /> : <Play className="size-4" />}</button> : null}
        </div>
        <p className="hidden w-40 text-right text-[11px] tabular-nums text-text-muted sm:block">{t('pres.slide', { n: index + 1, total: scenes.length })}</p>
      </footer>
    </div>,
    container,
  );
}
