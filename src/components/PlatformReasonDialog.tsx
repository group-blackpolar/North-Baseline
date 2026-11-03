import { useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { answerReason, MIN_REASON_LENGTH, usePendingReason } from '@/lib/platformReason';

/** Asks a platform operator why they are writing to an organization they do not belong to (ADR-0002). */
export function PlatformReasonDialog() {
  const { t } = useI18n();
  const pending = usePendingReason();
  const [text, setText] = useState('');
  const close = (value: string | null) => { answerReason(value); setText(''); };
  return (
    <ConfirmDialog open={pending !== null} title={t('reason.title')} description={t('reason.body')} confirmLabel={t('reason.confirm')}
      disabled={text.trim().length < MIN_REASON_LENGTH} onConfirm={() => close(text)} onCancel={() => close(null)}>
      <Input autoFocus value={text} maxLength={500} placeholder={t('reason.placeholder')} aria-label={t('reason.title')}
        onChange={(event) => setText(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && text.trim().length >= MIN_REASON_LENGTH) close(text); }} />
    </ConfirmDialog>
  );
}
