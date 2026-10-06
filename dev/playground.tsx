import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Gear, Plus, Tray, Trash } from '@phosphor-icons/react';
import '../src/index.css';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Sheet } from '@/components/ui/sheet';
import { Dialog } from '@/components/ui/dialog';
import { Status } from '@/components/ui/status';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Card } from '@/components/ui/card';
import { SkeletonRows } from '@/components/ui/skeleton';

const theme = new URLSearchParams(location.search).get('theme') ?? 'light';
document.documentElement.dataset.theme = theme;

function Playground() {
  const [sheet, setSheet] = useState<'left' | 'right' | 'bottom' | null>(null);
  const [dialog, setDialog] = useState(false);
  return (
    <div className="north-app-shell overflow-auto bg-background p-6 text-text">
      <PageHeader title="Primitives" description="Dev gallery" actions={<Button variant="accent"><Plus />New</Button>} />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary">Primary</Button><Button>Secondary</Button><Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button><Button variant="destructive">Delete</Button><Button loading>Saving</Button>
        <IconButton label="Settings" icon={<Gear />} /><IconButton label="Delete" icon={<Trash />} variant="outline" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['neutral', 'active', 'pending', 'info', 'error'] as const).map((t) => <Status key={t} tone={t}>{t}</Status>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(['left', 'right', 'bottom'] as const).map((s) => <Button key={s} onClick={() => setSheet(s)}>Sheet {s}</Button>)}
        <Button onClick={() => setDialog(true)}>Dialog</Button>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="p-4">Static card</Card>
        <Card selected className="p-4">Selected card</Card>
        <EmptyState icon={Tray} title="Nothing here" body="Honest empty state." action={<Button size="sm">Create</Button>} secondaryAction={<Button size="sm" variant="ghost">Learn more</Button>} />
        <SkeletonRows rows={3} />
      </div>
      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} title="Sheet" description="Drawer content" side={sheet ?? 'bottom'} footer={<Button className="w-full" onClick={() => setSheet(null)}>Done</Button>}>
        <p className="text-sm text-text-secondary">Body</p>
      </Sheet>
      <Dialog open={dialog} onOpenChange={setDialog} title="Dialog" description="Centered on desktop, sheet on phone" footer={<Button variant="primary" onClick={() => setDialog(false)}>OK</Button>}>
        <p className="text-sm text-text-secondary">Body</p>
      </Dialog>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<TooltipProvider><Playground /></TooltipProvider>);
