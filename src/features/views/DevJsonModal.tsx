import { DialogFrame } from '@/components/ui/dialog';
import { useViewsEditor } from './ViewsEditorContext';
import { useI18n } from '@/lib/i18n';
import { Button } from '@/components/ui/button';

/** Fase 6: visor JSON seguro de solo lectura para desarrolladores. */
export function DevJsonModal() {
  const { modal, setModal, activeDocument } = useViewsEditor();
  const { t } = useI18n();
  if (!modal || modal.type !== 'dev_json') return null;

  return (
    <DialogFrame open onOpenChange={(open) => { if (!open) setModal(null); }} label={t('views.devJson.title')} size="lg">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">{t('views.devJson.title')}</h2>
          <Button variant="outline" size="sm" onClick={() => setModal(null)}>
            {t('views.cancel')}
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-text-muted">{t('views.devJson.hint')}</p>
        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-background p-4 font-mono text-[11px] text-text-secondary">
          {JSON.stringify(activeDocument, null, 2)}
        </pre>
      </div>
    </DialogFrame>
  );
}
