import type { ReactNode } from 'react';
import { Button } from './button';
import { Dialog } from './dialog';
import { useI18n } from '@/lib/i18n';

/** Sensitive-action confirmation built on the NORTH dialog (never window.confirm). */
export function ConfirmDialog({ open, title, description, confirmLabel, destructive, busy, disabled, error, children, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }} title={title} description={description} size="sm"
      footer={<>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>{t('access.cancel')}</Button>
        <Button variant={destructive ? 'destructive' : 'primary'} loading={busy} disabled={disabled} onClick={onConfirm}>{confirmLabel}</Button>
      </>}>
      {children}
      {error && <p role="alert" className="mt-2 text-xs text-error">{error}</p>}
    </Dialog>
  );
}
