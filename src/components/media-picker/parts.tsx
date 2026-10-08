import { useEffect, useState, type DragEvent, type ReactNode } from 'react';
import { UploadSimple, X } from '@phosphor-icons/react';
import { IconButton } from '@/components/ui/icon-button';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Object URLs for previews. Every URL is revoked when the files change or the component unmounts. */
function useObjectUrls(files: File[]) {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const created = files.map((file) => URL.createObjectURL(file));
    setUrls(created);
    return () => created.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return urls;
}

export function SelectedMediaGrid({ files, onRemove }: { files: File[]; onRemove: (index: number) => void }) {
  const { t } = useI18n();
  const urls = useObjectUrls(files);
  if (!files.length) return null;
  return (
    <ul className="grid grid-cols-4 gap-2" aria-label={t('media.selected', { n: files.length })}>
      {files.map((file, index) => (
        <li key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square overflow-hidden rounded-lg bg-surface-hover">
          {urls[index] && <img src={urls[index]} alt={file.name} className="size-full object-cover" />}
          <IconButton label={t('media.remove')} size="icon-sm" variant="secondary" icon={<X />} onClick={() => onRemove(index)} className="absolute right-1 top-1" />
        </li>
      ))}
    </ul>
  );
}

/** Click, keyboard or drag-and-drop target. The actual file input lives in the picker. */
export function FileDropzone({ onBrowse, onFiles, children }: { onBrowse: () => void; onFiles: (files: File[]) => void; children?: ReactNode }) {
  const { t } = useI18n();
  const [over, setOver] = useState(false);
  const drop = (event: DragEvent) => { event.preventDefault(); setOver(false); onFiles([...event.dataTransfer.files]); };
  return (
    <button
      type="button"
      onClick={onBrowse}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
      className={cn('flex min-h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-hover/50 p-6 text-center outline-none transition-colors duration-(--duration-fast) hover:border-accent focus-visible:ring-2 focus-visible:ring-accent/50', over && 'border-accent bg-accent-soft')}
    >
      <UploadSimple className="size-7 text-text-muted" aria-hidden="true" />
      <span className="text-sm font-medium text-text">{t('media.drop')}</span>
      <span className="text-xs text-text-muted">{t('media.paste')}</span>
      {children}
    </button>
  );
}
