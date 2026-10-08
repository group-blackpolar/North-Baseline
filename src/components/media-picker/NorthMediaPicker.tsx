import { useEffect, useRef, useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Camera, CameraRotate, Images, UploadSimple, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { IconButton } from '@/components/ui/icon-button';
import { portalContainer } from '@/components/ui/portal';
import { useI18n } from '@/lib/i18n';
import { useOverlayHistory } from '@/lib/overlayHistory';
import { useIsCompactShell, useMediaQuery } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import { CameraPreview } from './CameraPreview.tsx';
import { GalleryBottomSheet } from './GalleryBottomSheet.tsx';
import { ImageEditor, type Aspect } from './ImageEditor.tsx';
import { DEFAULT_MAX_BYTES, IMAGE_MIME, isHeif, mergeSelection, sniffImageMime, type MediaErrorCode } from './logic.ts';
import { FileDropzone, SelectedMediaGrid } from './parts.tsx';
import { useCamera } from './useCamera.ts';

export type MediaMode = 'avatar' | 'icon' | 'photo' | 'banner' | 'free';

const MODE_ASPECTS: Record<MediaMode, Aspect[]> = {
  avatar: [1], icon: [1], photo: [4 / 3, 'original'], banner: [16 / 9], free: ['original', 1, 4 / 3, 16 / 9],
};

export interface NorthMediaPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preset of crop ratios. `aspectRatio` overrides it. */
  mode?: MediaMode;
  aspectRatio?: Aspect | Aspect[];
  multiple?: boolean;
  maxFiles?: number;
  maxBytes?: number;
  title?: string;
  /**
   * Receives the final, edited files. It does NOT upload anything by itself: the caller decides whether and where
   * to store them (see `lib/assets.ts`). A thrown error is shown in the picker and keeps it open.
   */
  onSelect: (files: File[]) => void | Promise<void>;
}

type Step = { kind: 'acquire' } | { kind: 'edit'; file: File; fromCamera: boolean };

/** Reads the real type from the first bytes and fixes a missing/wrong `File.type`. */
async function intake(files: File[]): Promise<{ ok: File[]; errors: MediaErrorCode[] }> {
  const ok: File[] = [];
  const errors: MediaErrorCode[] = [];
  for (const file of files) {
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const real = sniffImageMime(head);
    if (!real) { errors.push(file.size === 0 ? 'empty' : isHeif(head) ? 'heic' : 'format'); continue; }
    ok.push(real === file.type ? file : new File([file], file.name, { type: real, lastModified: file.lastModified }));
  }
  return { ok, errors };
}

function Body({ immersive, onClose, ...props }: Omit<NorthMediaPickerProps, 'open' | 'onOpenChange'> & { immersive: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { multiple = false, maxFiles = 1, maxBytes = DEFAULT_MAX_BYTES, onSelect } = props;
  const aspects = ([] as Aspect[]).concat(props.aspectRatio ?? MODE_ASPECTS[props.mode ?? 'free']);
  const accept = IMAGE_MIME;

  const [step, setStep] = useState<Step>({ kind: 'acquire' });
  const [tab, setTab] = useState<'files' | 'camera'>('files');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selection, setSelection] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const cameraOn = step.kind === 'acquire' && (immersive || tab === 'camera');
  const camera = useCamera(cameraOn);

  const describe = (code: MediaErrorCode | 'count') => t(`media.err.${code}` as 'media.err.format', { max: Math.round(maxBytes / 1048576) });

  const finish = async (files: File[]) => {
    setBusy(true); setError(null);
    try { await onSelect(files); onClose(); }
    catch (reason) { setError(reason instanceof Error && reason.message ? reason.message : t('media.err.upload')); }
    finally { setBusy(false); }
  };

  /** Single mode edits the picked image; multiple mode collects it. */
  const add = (file: File, fromCamera: boolean) => {
    const { next, rejected } = mergeSelection(selection, [file], { multiple, maxFiles, accept, maxBytes });
    if (rejected[0]) { setError(describe(rejected[0].code)); return; }
    setError(null);
    if (!multiple) { setStep({ kind: 'edit', file, fromCamera }); return; }
    setSelection(next);
    setStep({ kind: 'acquire' });
    if (next.length >= maxFiles) void finish(next);
  };

  const receive = async (files: File[]) => {
    if (!files.length) return;
    const { ok, errors } = await intake(files);
    const merged = mergeSelection(multiple ? selection : [], multiple ? ok : ok.slice(0, 1), { multiple, maxFiles, accept, maxBytes });
    const first = errors[0] ?? merged.rejected[0]?.code;
    setError(first ? describe(first) : null);
    if (multiple) setSelection(merged.next);
    else if (merged.next[0]) setStep({ kind: 'edit', file: merged.next[0], fromCamera: false });
  };

  // Pasting an image works on desktop while the acquire step is showing.
  useEffect(() => {
    if (step.kind !== 'acquire' || immersive) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); void receive(files); }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  });

  const shoot = async () => { const file = await camera.capture(); if (file) add(file, true); else setError(t('media.err.decode')); };
  const browse = () => input.current?.click();

  const picker = (
    <input
      ref={input} type="file" accept={accept.join(',')} multiple={multiple} className="hidden"
      onChange={(event) => { void receive([...(event.target.files ?? [])]); event.target.value = ''; }}
    />
  );
  const errorLine = error && <p role="alert" className="text-sm text-error">{error}</p>;
  const confirmSelection = multiple && selection.length > 0 && (
    <Button variant="accent" loading={busy} onClick={() => void finish(selection)}>{t('media.confirm')} ({selection.length})</Button>
  );

  if (step.kind === 'edit') {
    return (
      <div className={cn('flex min-h-0 flex-1 flex-col', immersive ? 'overflow-y-auto bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]' : 'h-[70dvh]')}>
        {picker}
        <ImageEditor
          file={step.file} aspects={aspects}
          backLabel={step.fromCamera ? t('media.retake') : t('media.cancel')}
          onBack={() => { setError(null); setStep({ kind: 'acquire' }); }}
          onConfirm={(file) => { if (multiple) { setSelection((current) => mergeSelection(current, [file], { multiple, maxFiles, accept, maxBytes }).next); setStep({ kind: 'acquire' }); } else void finish([file]); }}
        />
        {busy && <span className="sr-only" role="status">{t('media.confirm')}…</span>}
        {errorLine}
      </div>
    );
  }

  if (immersive) {
    return (
      <div className="relative flex-1 overflow-hidden bg-black">
        {picker}
        <CameraPreview camera={camera} onChooseFile={browse} className="absolute inset-0" />
        <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between pb-3 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pt-[max(0.75rem,env(safe-area-inset-top))]">
          <IconButton label={t('media.cancel')} icon={<X />} onClick={onClose} className="bg-black/40 text-white hover:bg-black/60 hover:text-white" />
          {camera.canSwitch && <IconButton label={t('media.switch')} icon={<CameraRotate />} onClick={camera.flip} className="bg-black/40 text-white hover:bg-black/60 hover:text-white" />}
        </div>
        {errorLine && <div className="absolute inset-x-4 top-16 z-10 rounded-lg bg-surface/95 p-3">{errorLine}</div>}
        <div className="absolute inset-x-0 bottom-[calc(64px+max(1.25rem,env(safe-area-inset-bottom)))] z-10 flex justify-center landscape:inset-x-auto landscape:bottom-1/2 landscape:right-[max(1.25rem,env(safe-area-inset-right))] landscape:translate-y-1/2">
          <button
            type="button" aria-label={t('media.take')} disabled={camera.state !== 'ready'} onClick={() => void shoot()}
            className="grid size-[72px] place-items-center rounded-full border-4 border-white outline-none transition-transform duration-(--duration-fast) active:scale-95 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40 motion-reduce:transition-none"
          >
            <span className="size-14 rounded-full bg-white" />
          </button>
        </div>
        <GalleryBottomSheet expanded={sheetOpen} onExpandedChange={setSheetOpen} title={t('media.gallery')}>
          <div className="space-y-4 pb-2">
            <Button variant="accent" className="w-full" onClick={browse}><Images />{t('media.chooseFile')}</Button>
            <p className="text-xs text-text-muted">{t('media.galleryNote')}</p>
            <SelectedMediaGrid files={selection} onRemove={(index) => setSelection((current) => current.filter((_, i) => i !== index))} />
            {confirmSelection}
          </div>
        </GalleryBottomSheet>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {picker}
      <div role="tablist" aria-label={t('media.add')} className="flex gap-1">
        {(['files', 'camera'] as const).map((id) => (
          <Button key={id} role="tab" aria-selected={tab === id} size="sm" variant={tab === id ? 'accent' : 'secondary'} onClick={() => setTab(id)}>
            {id === 'files' ? <UploadSimple /> : <Camera />}{id === 'files' ? t('media.files') : t('media.camera')}
          </Button>
        ))}
      </div>
      {tab === 'files' ? (
        <FileDropzone onBrowse={browse} onFiles={(files) => void receive(files)} />
      ) : (
        <div className="space-y-3">
          <CameraPreview camera={camera} onChooseFile={() => { setTab('files'); browse(); }} className="aspect-4/3 w-full rounded-xl" />
          <div className="flex items-center justify-center gap-2">
            {camera.canSwitch && <IconButton label={t('media.switch')} icon={<CameraRotate />} variant="secondary" onClick={camera.flip} />}
            <Button variant="accent" disabled={camera.state !== 'ready'} onClick={() => void shoot()}><Camera />{t('media.take')}</Button>
          </div>
        </div>
      )}
      {multiple && <SelectedMediaGrid files={selection} onRemove={(index) => setSelection((current) => current.filter((_, i) => i !== index))} />}
      {errorLine}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{t('media.cancel')}</Button>
        {confirmSelection}
      </div>
    </div>
  );
}

/**
 * Universal image picker: acquire (camera / file picker / drop / paste), edit (frame, zoom, rotate) and hand the
 * result to `onSelect`. Phones and portrait tablets get an immersive camera with a swipeable gallery panel;
 * desktop gets a dialog. The camera is only opened when the picker is showing it and is released on every exit.
 */
export function NorthMediaPicker({ open, onOpenChange, title, ...rest }: NorthMediaPickerProps) {
  const { t } = useI18n();
  // Touch devices stay immersive in both orientations (a rotation must not swap the UI and restart the camera).
  const narrow = useIsCompactShell();
  const touch = useMediaQuery('(pointer: coarse)');
  const compact = narrow || touch;
  const close = () => onOpenChange(false);
  useOverlayHistory(open && compact, close);
  const label = title ?? t('media.add');

  if (!compact) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange} title={label} size="md">
        {open && <Body {...rest} immersive={false} onClose={close} />}
      </Dialog>
    );
  }
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal container={portalContainer()}>
        <D.Content aria-describedby={undefined} className="np-sheet fixed inset-0 z-(--z-modal) flex flex-col bg-black outline-none" data-side="bottom">
          <D.Title className="sr-only">{label}</D.Title>
          {open && <Body {...rest} immersive onClose={close} />}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
