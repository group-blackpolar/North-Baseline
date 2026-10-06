import { DialogFrame } from '@/components/ui/dialog';
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowLeft, ChatCircle, DotsThreeVertical, DownloadSimple, Envelope, PencilSimple, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ResponsiveList } from '@/components/ui/responsive-list';
import { Sheet } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { useShellMode } from '@/lib/responsive';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  changeDocumentStatus, deleteDocument, fetchAttachment, fetchPdf, getDocument, listDocumentEvents, sendDocumentEmail, sendDocumentWhatsApp,
  type ChannelState, type DocumentAttachment, type DocumentDetail as DocumentRecord, type DocumentEvent, type DocumentStatus,
} from './api';
import { formatMoney } from './money';
import { ErrorNote, StatusBadge, errorText, fieldLabel, formatDate, formatDateTime, localizedLabel, saveBlob, selectClass, useBlobUrl } from './shared';

export type DocumentCan = { create: boolean; update: boolean; delete: boolean; download: boolean; send: boolean };

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <DialogFrame open onOpenChange={(open) => { if (!open) onClose(); }} label={title}>
      <div className="space-y-4">
        <h3 className="font-display text-lg font-semibold text-text">{title}</h3>
        {children}
      </div>
    </DialogFrame>
  );
}

function Notice({ tone, children }: { tone: 'warn' | 'info'; children: ReactNode }) {
  return <p role="status" className={cn('rounded-lg border px-3 py-2 text-xs leading-relaxed', tone === 'warn' ? 'border-warning/40 bg-warning/10 text-text-secondary' : 'border-border bg-surface-hover text-text-secondary')}>{children}</p>;
}

function SendDialog({ kind, organizationId, document, channel, onClose, onSent }: {
  kind: 'email' | 'whatsapp'; organizationId: string; document: DocumentRecord; channel: ChannelState; onClose: () => void; onSent: (document: DocumentRecord) => void;
}) {
  const { t, locale } = useI18n();
  const [to, setTo] = useState(kind === 'email' ? document.client.email ?? '' : document.client.phone ?? '');
  const [subject, setSubject] = useState(document.reference);
  const [message, setMessage] = useState(kind === 'email' ? t('documents.email.defaultMessage', { reference: document.reference }) : t('documents.whatsapp.defaultMessage', { reference: document.reference }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const language = locale === 'en' ? 'en' : 'es';
  const available = channel === 'available';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const updated = kind === 'email'
        ? await sendDocumentEmail(organizationId, document.id, { to: to.trim(), subject: subject.trim(), message, language })
        : await sendDocumentWhatsApp(organizationId, document.id, { to: to.trim(), message, language });
      onSent(updated);
    } catch (reason) { setError(errorText(reason)); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={kind === 'email' ? t('documents.sendEmail') : t('documents.sendWhatsApp')} onClose={onClose}>
      {!available && <Notice tone="warn">{kind === 'email' ? t('documents.email.pending') : t('documents.whatsapp.pending')}</Notice>}
      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <label className="block space-y-1"><span className={fieldLabel}>{kind === 'email' ? t('documents.client.email') : t('documents.whatsapp.number')}</span>
          <Input autoFocus required value={to} type={kind === 'email' ? 'email' : 'tel'} onChange={(event) => setTo(event.target.value)} disabled={!available} placeholder={kind === 'whatsapp' ? '+507 6000 0000' : undefined} />
        </label>
        {kind === 'whatsapp' && <p className="text-xs text-text-muted">{t('documents.whatsapp.hint')}</p>}
        {kind === 'email' && <label className="block space-y-1"><span className={fieldLabel}>{t('documents.email.subject')}</span><Input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={!available} /></label>}
        <label className="block space-y-1"><span className={fieldLabel}>{t('documents.message')}</span>
          <textarea rows={4} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} disabled={!available} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:opacity-50" />
        </label>
        <p className="text-xs text-text-muted">{t('documents.send.attachment', { file: `${document.reference}.pdf` })}</p>
        <ErrorNote message={error} />
        <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>{t('access.cancel')}</Button><Button type="submit" variant="accent" disabled={busy || !available || !to.trim()}>{busy ? t('documents.sending') : t('documents.send')}</Button></div>
      </form>
    </Modal>
  );
}

function AttachmentImage({ organizationId, documentId, attachment }: { organizationId: string; documentId: string; attachment: DocumentAttachment }) {
  const { url, failed } = useBlobUrl(() => fetchAttachment(organizationId, documentId, attachment.id), attachment.id);
  if (!url) return <div className={cn('aspect-square rounded-lg', failed ? 'bg-error/10' : 'animate-pulse bg-surface-active')} />;
  return <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-border"><img src={url} alt={attachment.filename} className="aspect-square w-full object-cover" /></a>;
}

export function DocumentDetail({ organizationId, documentId, initial, can, channels, onBack, onEdit, onChanged, onDeleted }: {
  organizationId: string;
  documentId: string;
  initial?: DocumentRecord;
  can: DocumentCan;
  channels: { email: ChannelState; whatsapp: ChannelState };
  onBack: () => void;
  onEdit: (document: DocumentRecord) => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const { t, locale } = useI18n();
  const [document, setDocument] = useState<DocumentRecord | null>(initial ?? null);
  const [events, setEvents] = useState<DocumentEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'email' | 'whatsapp' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const phone = useShellMode() === 'phone';

  const reload = useCallback(async () => {
    try {
      const [doc, history] = await Promise.all([getDocument(organizationId, documentId), listDocumentEvents(organizationId, documentId)]);
      setDocument(doc); setEvents(history); setError(null);
    } catch (reason) { setError(errorText(reason)); }
  }, [organizationId, documentId]);
  useEffect(() => { void reload(); }, [reload]);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key); setError(null); setNotice(null);
    try { await work(); } catch (reason) { setError(errorText(reason)); } finally { setBusy(null); }
  };

  if (!document) {
    return error ? <div className="space-y-3"><Button variant="ghost" onClick={onBack}><ArrowLeft className="size-4" />{t('documents.back')}</Button><ErrorNote message={error} /></div>
      : <div aria-busy="true" className="space-y-3"><Skeleton className="h-8 w-56" /><Skeleton className="h-40 w-full rounded-xl" /></div>;
  }

  const eventLabel = (action: string) => {
    const key = `documents.event.${action}`;
    const value = t(key as never);
    return value === key ? action : value;
  };
  const sendable = document.status === 'READY' || document.status === 'SENT' || document.status === 'COMPLETED';
  const transitions = document.allowedTransitions.filter((status) => (status === 'SENT' ? can.send : can.update));
  const changeStatus = (to: DocumentStatus) => {
    if (to === 'CANCELLED' && !window.confirm(t('documents.confirmCancel'))) return;
    void run('status', async () => { setDocument(await changeDocumentStatus(organizationId, document.id, to)); onChanged(); await reload(); });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2"><ArrowLeft className="size-4" />{t('documents.back')}</Button>
          <div className="flex flex-wrap items-center gap-2"><h2 className="mono-data text-xl font-semibold text-text">{document.reference}</h2><StatusBadge status={document.status} label={t(`documents.status.${document.status}` as never)} /></div>
          <p className="text-xs text-text-muted">{localizedLabel(document.type.name, locale)} · {formatDate(document.date, locale)}</p>
        </div>
        {phone ? (
          <div className="flex w-full items-center gap-2">
            {can.update && document.editable
              ? <Button variant="primary" className="flex-1" onClick={() => onEdit(document)}><PencilSimple className="size-4" />{t('documents.edit')}</Button>
              : can.download && <Button variant="primary" className="flex-1" disabled={busy === 'pdf'} onClick={() => void run('pdf', async () => { saveBlob(await fetchPdf(organizationId, document.id, locale === 'en' ? 'en' : 'es'), `${document.reference}.pdf`); await reload(); })}><DownloadSimple className="size-4" />{t('documents.downloadPdf')}</Button>}
            <Button variant="secondary" size="icon" aria-label={t('documents.moreActions')} onClick={() => setMenuOpen(true)}><DotsThreeVertical className="size-5" /></Button>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen} side="bottom" title={t('documents.moreActions')}>
              <div className="flex flex-col gap-1 [&>button]:justify-start [&>button]:text-left">
                {can.download && <Button variant="ghost" disabled={busy === 'pdf'} onClick={() => { setMenuOpen(false); void run('pdf', async () => { saveBlob(await fetchPdf(organizationId, document.id, locale === 'en' ? 'en' : 'es'), `${document.reference}.pdf`); await reload(); }); }}><DownloadSimple className="size-4" />{t('documents.downloadPdf')}</Button>}
                {can.send && sendable && <Button variant="ghost" onClick={() => { setMenuOpen(false); setDialog('email'); }}><Envelope className="size-4" />{t('documents.sendEmail')}</Button>}
                {can.send && sendable && <Button variant="ghost" onClick={() => { setMenuOpen(false); setDialog('whatsapp'); }}><ChatCircle className="size-4" />{t('documents.sendWhatsApp')}</Button>}
                {transitions.map((status) => <Button key={status} variant="ghost" disabled={busy === 'status'} onClick={() => { setMenuOpen(false); changeStatus(status); }}>{t('documents.changeStatus')}: {t(`documents.status.${status}` as never)}</Button>)}
                {can.delete && document.status === 'DRAFT' && <Button variant="ghost" className="text-error" disabled={busy === 'delete'} onClick={() => { setMenuOpen(false); if (window.confirm(t('documents.confirmDelete'))) void run('delete', async () => { await deleteDocument(organizationId, document.id); onDeleted(); }); }}><Trash className="size-4" />{t('documents.delete')}</Button>}
              </div>
            </Sheet>
          </div>
        ) : (
        <div className="flex flex-wrap items-center gap-2">
          {can.update && document.editable && <Button variant="secondary" onClick={() => onEdit(document)}><PencilSimple className="size-4" />{t('documents.edit')}</Button>}
          {can.download && <Button variant="secondary" disabled={busy === 'pdf'} onClick={() => void run('pdf', async () => { saveBlob(await fetchPdf(organizationId, document.id, locale === 'en' ? 'en' : 'es'), `${document.reference}.pdf`); await reload(); })}><DownloadSimple className="size-4" />{t('documents.downloadPdf')}</Button>}
          {can.send && sendable && <Button variant="secondary" onClick={() => setDialog('email')}><Envelope className="size-4" />{t('documents.sendEmail')}</Button>}
          {can.send && sendable && <Button variant="secondary" onClick={() => setDialog('whatsapp')}><ChatCircle className="size-4" />{t('documents.sendWhatsApp')}</Button>}
          {transitions.length > 0 && (
            <select aria-label={t('documents.changeStatus')} className={selectClass} value="" disabled={busy === 'status'} onChange={(event) => { if (event.target.value) changeStatus(event.target.value as DocumentStatus); }}>
              <option value="">{t('documents.changeStatus')}</option>
              {transitions.map((status) => <option key={status} value={status}>{t(`documents.status.${status}` as never)}</option>)}
            </select>
          )}
          {can.delete && document.status === 'DRAFT' && <Button variant="ghost" aria-label={t('documents.delete')} title={t('documents.delete')} disabled={busy === 'delete'} onClick={() => { if (window.confirm(t('documents.confirmDelete'))) void run('delete', async () => { await deleteDocument(organizationId, document.id); onDeleted(); }); }}><Trash className="size-4" /></Button>}
        </div>
        )}
      </header>
      <ErrorNote message={error} />
      {notice && <p role="status" className="text-xs text-success">{notice}</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <section className="np-card space-y-1 p-4 lg:p-5">
            <h3 className="ui-label">{t('documents.client')}</h3>
            <p className="text-base font-medium text-text">{document.client.name}</p>
            <p className="text-sm text-text-secondary">{[document.client.email, document.client.phone].filter(Boolean).join(' · ') || '—'}</p>
          </section>

          <section className="np-card overflow-x-auto p-0">
            <ResponsiveList items={document.items} getKey={(item) => item.id} renderCard={(item) => (
              <div className="flex items-start justify-between gap-3 rounded-lg bg-surface-hover/50 px-3 py-2.5">
                <span className="min-w-0"><span className="block font-medium text-text">{item.name}</span>{item.description && <span className="block text-xs text-text-muted">{item.description}</span>}</span>
                <span className="shrink-0 text-right text-sm tabular-nums"><span className="block text-xs text-text-secondary">{item.quantity} × {formatMoney(item.unitPrice, document.currency, locale)}</span><span className="block text-text">{formatMoney(item.total, document.currency, locale)}</span></span>
              </div>
            )} table={<table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead><tr className="text-left text-[11px] uppercase tracking-wide text-text-muted">
                  <th className="border-b border-border px-4 py-2 font-medium">{t('documents.item')}</th><th className="border-b border-border px-3 py-2 text-right font-medium">{t('documents.quantity')}</th>
                  <th className="border-b border-border px-3 py-2 text-right font-medium">{t('documents.price')}</th><th className="border-b border-border px-4 py-2 text-right font-medium">{t('documents.col.total')}</th>
                </tr></thead>
                <tbody>
                  {document.items.map((item) => (
                    <tr key={item.id}>
                      <td className="border-b border-border/60 px-4 py-2.5"><span className="block font-medium text-text">{item.name}</span>{item.description && <span className="block text-xs text-text-muted">{item.description}</span>}</td>
                      <td className="border-b border-border/60 px-3 py-2.5 text-right tabular-nums">{item.quantity}</td>
                      <td className="border-b border-border/60 px-3 py-2.5 text-right tabular-nums">{formatMoney(item.unitPrice, document.currency, locale)}</td>
                      <td className="border-b border-border/60 px-4 py-2.5 text-right tabular-nums">{formatMoney(item.total, document.currency, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>} />
            <dl className="ml-auto w-full max-w-xs space-y-1 p-4 text-sm">
              <div className="flex justify-between text-text-secondary"><dt>{t('documents.subtotal')}</dt><dd className="tabular-nums">{formatMoney(document.subtotal, document.currency, locale)}</dd></div>
              <div className="flex justify-between font-display text-base font-semibold text-text"><dt>{t('documents.col.total')}</dt><dd className="tabular-nums">{formatMoney(document.total, document.currency, locale)}</dd></div>
            </dl>
          </section>

          {document.comments && <section className="np-card space-y-1 p-4 lg:p-5"><h3 className="ui-label">{t('documents.comments')}</h3><p className="whitespace-pre-wrap text-sm leading-relaxed text-text">{document.comments}</p></section>}

          {document.attachments.length > 0 && (
            <section className="np-card space-y-2 p-4 lg:p-5"><h3 className="ui-label">{t('documents.attachments')}</h3>
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">{document.attachments.map((attachment) => <li key={attachment.id}><AttachmentImage organizationId={organizationId} documentId={document.id} attachment={attachment} /></li>)}</ul>
            </section>
          )}
        </div>

        <aside className="np-card h-fit space-y-3 p-4" aria-label={t('documents.history')}>
          <h3 className="ui-label">{t('documents.history')}</h3>
          {events.length === 0 ? <Skeleton className="h-16 w-full" /> : (
            <ol className="space-y-3 border-l border-border pl-3">
              {events.map((event) => (
                <li key={event.id} className="relative text-xs">
                  <span className="absolute -left-[17px] top-1 size-2 rounded-full bg-accent" aria-hidden="true" />
                  <p className="font-medium text-text">{eventLabel(event.action)}</p>
                  <p className="text-text-muted">{formatDateTime(event.createdAt, locale)}{event.actorName ? ` · ${event.actorName}` : ''}</p>
                  {event.action === 'DOCUMENT_STATUS_CHANGED' && typeof event.metadata.to === 'string' && <p className="text-text-secondary">{t(`documents.status.${String(event.metadata.from)}` as never)} → {t(`documents.status.${event.metadata.to}` as never)}</p>}
                  {typeof event.metadata.to === 'string' && /EMAIL|WHATSAPP/.test(event.action) && <p className="text-text-secondary">{event.metadata.to}</p>}
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      {dialog && <SendDialog kind={dialog} organizationId={organizationId} document={document} channel={dialog === 'email' ? channels.email : channels.whatsapp} onClose={() => setDialog(null)}
        onSent={(updated) => { setDocument(updated); setDialog(null); setNotice(t('documents.sent')); onChanged(); void reload(); }} />}
    </div>
  );
}
