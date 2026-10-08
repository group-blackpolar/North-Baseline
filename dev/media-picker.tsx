import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { NorthMediaPicker, type MediaMode } from '@/components/media-picker';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { I18nProvider } from '@/lib/i18n';

const params = new URLSearchParams(location.search);
document.documentElement.dataset.theme = params.get('theme') ?? 'light';

function Harness() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const next = files.map((file) => URL.createObjectURL(file));
    setUrls(next);
    return () => next.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return (
    <div className="north-app-shell overflow-auto bg-background p-6 text-text">
      <Button variant="accent" onClick={() => setOpen(true)}>Add image</Button>
      <p className="mt-3 text-sm" data-testid="result">{files.map((file) => `${file.name} ${file.type} ${file.size}`).join(' | ') || 'none'}</p>
      <div className="mt-3 flex gap-2">{urls.map((url) => <img key={url} src={url} alt="" className="h-24 rounded-lg" />)}</div>
      <NorthMediaPicker
        open={open} onOpenChange={setOpen}
        mode={(params.get('mode') as MediaMode) ?? 'free'} multiple={params.has('multiple')} maxFiles={3}
        onSelect={(selected) => setFiles(selected)}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <I18nProvider><TooltipProvider><Harness /></TooltipProvider></I18nProvider>,
);
