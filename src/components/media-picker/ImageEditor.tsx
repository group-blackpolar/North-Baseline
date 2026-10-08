import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { ArrowClockwise, Check, CircleNotch } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { cropWindow, fitSide, MAX_OUTPUT_SIDE, MAX_WORK_SIDE } from './logic.ts';

export type Aspect = number | 'original';
const VIEW_W = 720; // internal resolution of the framing canvas; CSS scales it

const ratioLabel = (a: number) => ({ '1': '1:1', [String(4 / 3)]: '4:3', [String(16 / 9)]: '16:9' })[String(a)] ?? a.toFixed(2);

/** Decodes honouring EXIF orientation and caps the longest side so big photos do not exhaust memory. */
async function decode(file: Blob): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file));
  const { w, h } = fitSide(bitmap.width, bitmap.height, MAX_WORK_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas;
}

function rotate(source: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  if (quarterTurns % 4 === 0) return source;
  const odd = quarterTurns % 2 !== 0;
  const canvas = document.createElement('canvas');
  canvas.width = odd ? source.height : source.width;
  canvas.height = odd ? source.width : source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarterTurns % 4) * (Math.PI / 2));
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

export interface ImageEditorProps {
  file: File;
  aspects: Aspect[];
  /** Label of the left action (e.g. "Retake" after a capture, "Cancel" for imported files). */
  backLabel: string;
  onBack: () => void;
  onConfirm: (file: File) => void;
  className?: string;
}

/** Frame, zoom, rotate. An untouched "original" image is returned as the very same File (no re-encoding). */
export function ImageEditor({ file, aspects, backLabel, onBack, onConfirm, className }: ImageEditorProps) {
  const { t } = useI18n();
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [aspect, setAspect] = useState<Aspect>(aspects[0] ?? 'original');
  const [turns, setTurns] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const view = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let live = true;
    setBase(null); setFailed(false);
    decode(file).then((canvas) => live && setBase(canvas)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [file]);

  const work = useMemo(() => (base ? rotate(base, turns) : null), [base, turns]);
  const ratio = work ? (aspect === 'original' ? work.width / work.height : aspect) : 1;
  const c = center ?? (work ? { x: work.width / 2, y: work.height / 2 } : { x: 0, y: 0 });
  const win = work ? cropWindow(work.width, work.height, ratio, zoom, c.x, c.y) : null;

  useEffect(() => {
    const canvas = view.current;
    if (!canvas || !work || !win) return;
    canvas.width = VIEW_W; canvas.height = Math.round(VIEW_W / ratio);
    canvas.getContext('2d')?.drawImage(work, win.sx, win.sy, win.sw, win.sh, 0, 0, canvas.width, canvas.height);
  });

  // Dropping the pan when the geometry changes keeps the frame centred.
  const reset = (next: () => void) => { setCenter(null); setZoom(1); next(); };
  const pan = (dxView: number, dyView: number) => {
    if (!win || !view.current) return;
    const k = win.sw / view.current.getBoundingClientRect().width;
    setCenter({ x: win.sx + win.sw / 2 - dxView * k, y: win.sy + win.sh / 2 - dyView * k });
  };
  const onPointerMove = (event: PointerEvent) => {
    if (!drag.current) return;
    pan(event.clientX - drag.current.x, event.clientY - drag.current.y);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const step = 24;
    const delta = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
    if (delta) { event.preventDefault(); pan(delta[0], delta[1]); }
  };

  const confirm = async () => {
    if (!work || !win) return;
    if (aspect === 'original' && turns % 4 === 0 && zoom === 1) { onConfirm(file); return; }
    setBusy(true);
    const { w, h } = fitSide(win.sw, win.sh, MAX_OUTPUT_SIDE);
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    out.getContext('2d')?.drawImage(work, win.sx, win.sy, win.sw, win.sh, 0, 0, w, h);
    const type = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.92));
    out.width = out.height = 0;
    setBusy(false);
    if (!blob) { setFailed(true); return; }
    onConfirm(new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${type.split('/')[1].replace('jpeg', 'jpg')}`, { type }));
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      <div className="grid min-h-40 flex-1 place-items-center rounded-xl bg-surface-hover p-2">
        {failed ? (
          <p role="alert" className="text-sm text-error">{t('media.err.decode')}</p>
        ) : !work ? (
          <CircleNotch className="size-5 animate-spin text-text-muted" aria-label={t('media.cam.starting')} />
        ) : (
          <canvas
            ref={view}
            role="img" tabIndex={0}
            aria-label={`${t('media.editor')}. ${t('media.editorHint')}`}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY }; }}
            onPointerMove={onPointerMove}
            onPointerUp={() => { drag.current = null; }}
            onPointerCancel={() => { drag.current = null; }}
            onKeyDown={onKeyDown}
            style={{ aspectRatio: ratio }}
            className="max-h-full max-w-full cursor-grab touch-none rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:cursor-grabbing"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {aspects.length > 1 && (
          <div role="group" aria-label={t('media.crop')} className="flex gap-1">
            {aspects.map((option) => (
              <Button key={String(option)} size="sm" variant={option === aspect ? 'accent' : 'secondary'} aria-pressed={option === aspect} onClick={() => reset(() => setAspect(option))}>
                {option === 'original' ? t('media.aspect.original') : ratioLabel(option)}
              </Button>
            ))}
          </div>
        )}
        <Button size="sm" variant="secondary" onClick={() => reset(() => setTurns((n) => (n + 1) % 4))}><ArrowClockwise />{t('media.rotate')}</Button>
        <label className="ml-auto flex items-center gap-2 text-xs text-text-secondary">
          {t('media.zoom')}
          <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="w-28 accent-(--color-accent)" />
        </label>
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="ghost" onClick={onBack}>{backLabel}</Button>
        <Button variant="accent" loading={busy} disabled={!work || failed} onClick={() => void confirm()}><Check />{t('media.confirm')}</Button>
      </div>
    </div>
  );
}
