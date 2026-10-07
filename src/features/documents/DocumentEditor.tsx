import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { FloppyDisk, ImageSquare, Plus, Trash, X } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import {
  changeDocumentStatus, createDocument, fetchAttachment, removeAttachment, searchClients, updateDocument, uploadAttachment,
  type ClientSuggestion, type DocumentAttachment, type DocumentDetail, type DocumentType,
} from './api';
import { IMAGE_ACCEPT, imageMime } from './images';
import { centsToText, formatMoney, isPrice, isQuantity, lineCents, sumCents } from './money';
import { ErrorNote, errorText, fieldLabel, localizedLabel, toDateInput, useBlobUrl } from './shared';

type ItemRow = { key: string; name: string; description: string; quantity: string; unitPrice: string };
type PendingFile = { key: string; file: File; url: string };

const MAX_FILES = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
const blankItem = (): ItemRow => ({ key: newKey(), name: '', description: '', quantity: '1', unitPrice: '' });

function Thumb({ organizationId, documentId, attachment, onRemove, removable, label }: { organizationId: string; documentId: string; attachment: DocumentAttachment; onRemove: () => void; removable: boolean; label: string }) {
  const { url, failed } = useBlobUrl(() => fetchAttachment(organizationId, documentId, attachment.id), attachment.id);
  return (
    <li className="group relative size-24 overflow-hidden rounded-lg border border-border bg-surface-hover">
      {url ? <img src={url} alt={attachment.filename} className="size-full object-cover" /> : <div className={cn('size-full', failed ? 'bg-error/10' : 'animate-pulse')} />}
      {removable && <button type="button" onClick={onRemove} aria-label={`${label} ${attachment.filename}`} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-text-secondary opacity-0 shadow-soft transition-opacity hover:text-error focus-visible:opacity-100 group-hover:opacity-100"><X className="size-3.5" /></button>}
    </li>
  );
}

export function DocumentEditor({ organizationId, type, existing, onSaved, onCancel }: {
  organizationId: string;
  type: DocumentType;
  existing?: DocumentDetail;
  onSaved: (document: DocumentDetail) => void;
  onCancel: () => void;
}) {
  const { t, locale } = useI18n();
  const [current, setCurrent] = useState<DocumentDetail | undefined>(existing);
  const [clientId, setClientId] = useState<string | undefined>(existing?.client.id ?? undefined);
  const [selected, setSelected] = useState<ClientSuggestion | null>(existing?.client.id ? { id: existing.client.id, name: existing.client.name, email: existing.client.email, phone: existing.client.phone } : null);
  const [name, setName] = useState(existing?.client.name ?? '');
  const [email, setEmail] = useState(existing?.client.email ?? '');
  const [phone, setPhone] = useState(existing?.client.phone ?? '');
  const [date, setDate] = useState(toDateInput(existing?.date ?? new Date().toISOString()));
  const originalDate = useRef(date);
  const [items, setItems] = useState<ItemRow[]>(existing?.items.length ? existing.items.map((item) => ({ key: item.id, name: item.name, description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })) : [blankItem()]);
  const [comments, setComments] = useState(existing?.comments ?? '');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState<'draft' | 'final' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((entry) => URL.revokeObjectURL(entry.url)), []);

  // Reusable clients: suggestions only while the name is being typed and no client is selected.
  useEffect(() => {
    if (clientId || name.trim().length < 2) { setSuggestions([]); return; }
    let live = true;
    const timer = window.setTimeout(() => { void searchClients(organizationId, name.trim()).then((rows) => { if (live) setSuggestions(rows); }).catch(() => { if (live) setSuggestions([]); }); }, 200);
    return () => { live = false; window.clearTimeout(timer); };
  }, [clientId, name, organizationId]);

  const lines = useMemo(() => items.map((item) => lineCents(item.quantity, item.unitPrice)), [items]);
  const subtotal = useMemo(() => sumCents(lines), [lines]);
  const itemErrors = items.map((item) => ({ name: !item.name.trim(), quantity: !isQuantity(item.quantity), price: !isPrice(item.unitPrice) }));
  const valid = name.trim().length >= 2 && items.length > 0 && itemErrors.every((row) => !row.name && !row.quantity && !row.price);
  const existingAttachments = current?.attachments ?? [];

  const pickClient = (suggestion: ClientSuggestion) => {
    setClientId(suggestion.id); setSelected(suggestion); setName(suggestion.name); setEmail(suggestion.email ?? ''); setPhone(suggestion.phone ?? '');
    setSuggestions([]); setShowSuggestions(false);
  };
  const editClientField = (apply: () => void) => {
    apply();
    // Any manual edit turns the selection into explicit details; CORECROW re-matches by email.
    if (clientId) { setClientId(undefined); setSelected(null); }
  };
  const setItem = (key: string, patch: Partial<ItemRow>) => setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const addFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    const problems: string[] = [];
    const accepted: PendingFile[] = [];
    for (const file of files) {
      if (existingAttachments.length + pending.length + accepted.length >= MAX_FILES) { problems.push(t('documents.attach.limit')); break; }
      if (!imageMime(file)) { problems.push(`${file.name}: ${t('documents.attach.type')}`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`${file.name}: ${t('documents.attach.size')}`); continue; }
      accepted.push({ key: newKey(), file, url: URL.createObjectURL(file) });
    }
    setPending((rows) => [...rows, ...accepted]);
    setError(problems.length ? problems.join(' · ') : null);
  };
  const dropPending = (key: string) => setPending((rows) => { rows.filter((row) => row.key === key).forEach((row) => URL.revokeObjectURL(row.url)); return rows.filter((row) => row.key !== key); });
  const dropExisting = async (attachment: DocumentAttachment) => {
    if (!current) return;
    try { await removeAttachment(organizationId, current.id, attachment.id); setCurrent({ ...current, attachments: current.attachments.filter((item) => item.id !== attachment.id), version: current.version + 1 }); }
    catch (reason) { setError(errorText(reason)); }
  };

  const save = async (finalize: boolean) => {
    setSubmitted(true);
    if (!valid) return;
    setSaving(finalize ? 'final' : 'draft'); setError(null);
    try {
      const clientPayload = clientId && selected && selected.name === name && (selected.email ?? '') === email && (selected.phone ?? '') === phone
        ? { id: clientId }
        : { name: name.trim(), email: email.trim() || null, phone: phone.trim() || null };
      const payload = {
        client: clientPayload,
        items: items.map((item) => ({ name: item.name.trim(), description: item.description.trim(), quantity: item.quantity, unitPrice: item.unitPrice })),
        comments: comments.trim(),
        // An untouched date keeps the real server timestamp; an edited one is stored at local noon.
        ...(date !== originalDate.current ? { date: new Date(`${date}T12:00:00`).toISOString() } : {}),
      };
      let saved = current ? await updateDocument(organizationId, current.id, payload, current.version) : await createDocument(organizationId, type.id, payload);
      setCurrent(saved);
      originalDate.current = date;
      const failed: string[] = [];
      for (const entry of pending) {
        try { await uploadAttachment(organizationId, saved.id, entry.file); URL.revokeObjectURL(entry.url); setPending((rows) => rows.filter((row) => row.key !== entry.key)); }
        catch (reason) { failed.push(`${entry.file.name}: ${errorText(reason)}`); }
      }
      if (failed.length) { setError(`${t('documents.attach.failed')} ${failed.join(' · ')}`); return; }
      if (finalize && saved.status === 'DRAFT') saved = await changeDocumentStatus(organizationId, saved.id, 'READY');
      onSaved(saved);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSaving(null);
    }
  };

  const invalid = (flag: boolean) => (submitted && flag ? 'border-error' : '');

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="ui-label">{localizedLabel(type.name, locale)}</p>
          <h2 className="font-display text-xl font-semibold text-text">{current ? current.reference : t('documents.newTitle')}</h2>
        </div>
        <Button variant="ghost" onClick={onCancel} disabled={saving !== null}>{t('access.cancel')}</Button>
      </header>

      <section className="np-card space-y-3 p-4 lg:p-5">
        <h3 className="text-sm font-semibold text-text">{t('documents.client')}</h3>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="relative md:col-span-1">
            <label className="block space-y-1"><span className={fieldLabel}>{t('documents.client.name')}</span>
              <Input value={name} autoComplete="off" aria-invalid={submitted && name.trim().length < 2} className={invalid(name.trim().length < 2)}
                onChange={(event) => editClientField(() => setName(event.target.value))} onFocus={() => setShowSuggestions(true)} onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)} />
            </label>
            {showSuggestions && suggestions.length > 0 && (
              <ul role="listbox" aria-label={t('documents.client.suggestions')} className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-border bg-surface p-1 shadow-pop">
                {suggestions.map((suggestion) => (
                  <li key={suggestion.id}><button type="button" role="option" aria-selected={false} onMouseDown={(event) => event.preventDefault()} onClick={() => pickClient(suggestion)} className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-hover">
                    <span className="block truncate font-medium">{suggestion.name}</span><span className="block truncate text-xs text-text-muted">{suggestion.email ?? suggestion.phone ?? ''}</span>
                  </button></li>
                ))}
              </ul>
            )}
          </div>
          <label className="block space-y-1"><span className={fieldLabel}>{t('documents.client.email')}</span><Input type="email" value={email} autoComplete="off" onChange={(event) => editClientField(() => setEmail(event.target.value))} /></label>
          <label className="block space-y-1"><span className={fieldLabel}>{t('documents.client.phone')}</span><Input type="tel" value={phone} autoComplete="off" onChange={(event) => editClientField(() => setPhone(event.target.value))} /></label>
        </div>
        {clientId && <p className="text-xs text-text-muted">{t('documents.client.reused')}</p>}
        <label className="block max-w-[12rem] space-y-1"><span className={fieldLabel}>{t('documents.col.date')}</span><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </section>

      <section className="np-card space-y-3 p-4 lg:p-5">
        <h3 className="text-sm font-semibold text-text">{t('documents.items')}</h3>
        <div className="hidden grid-cols-[minmax(0,1fr)_6rem_8rem_7rem_2rem] gap-2 px-1 md:grid">
          <span className={fieldLabel}>{t('documents.item')}</span><span className={cn(fieldLabel, 'text-right')}>{t('documents.quantity')}</span><span className={cn(fieldLabel, 'text-right')}>{t('documents.price')}</span><span className={cn(fieldLabel, 'text-right')}>{t('documents.col.total')}</span><span />
        </div>
        <ul className="space-y-2">
          {items.map((item, index) => {
            const errors = itemErrors[index]!;
            const total = lines[index];
            return (
              <li key={item.key} className="north-enter grid grid-cols-2 gap-2 rounded-lg border border-border/70 p-2 md:grid-cols-[minmax(0,1fr)_6rem_8rem_7rem_2rem] md:border-0 md:p-0">
                <div className="col-span-2 space-y-1 md:col-span-1">
                  <Input value={item.name} placeholder={t('documents.item')} aria-label={t('documents.item')} aria-invalid={submitted && errors.name} className={invalid(errors.name)} onChange={(event) => setItem(item.key, { name: event.target.value })} />
                  <Input value={item.description} placeholder={t('documents.itemDescription')} aria-label={t('documents.itemDescription')} className="h-8 text-xs" onChange={(event) => setItem(item.key, { description: event.target.value })} />
                </div>
                <Input inputMode="decimal" value={item.quantity} aria-label={t('documents.quantity')} aria-invalid={submitted && errors.quantity} className={cn('text-right tabular-nums', invalid(errors.quantity))} onChange={(event) => setItem(item.key, { quantity: event.target.value })} />
                <Input inputMode="decimal" value={item.unitPrice} placeholder="0.00" aria-label={t('documents.price')} aria-invalid={submitted && errors.price} className={cn('text-right tabular-nums', invalid(errors.price))} onChange={(event) => setItem(item.key, { unitPrice: event.target.value })} />
                <output aria-label={t('documents.col.total')} className="flex h-9 items-center justify-end text-sm tabular-nums text-text">{total === null || total === undefined ? '—' : formatMoney(centsToText(total), type.currency, locale)}</output>
                <Button variant="ghost" size="icon" aria-label={t('documents.removeItem')} title={t('documents.removeItem')} disabled={items.length === 1} onClick={() => setItems((rows) => rows.filter((row) => row.key !== item.key))}><Trash className="size-4" /></Button>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" size="sm" onClick={() => setItems((rows) => [...rows, blankItem()])} disabled={items.length >= 100}><Plus className="size-4" />{t('documents.addItem')}</Button>
        <dl className="ml-auto w-full max-w-xs space-y-1 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-text-secondary"><dt>{t('documents.subtotal')}</dt><dd className="tabular-nums">{formatMoney(centsToText(subtotal), type.currency, locale)}</dd></div>
          <div className="flex justify-between font-display text-base font-semibold text-text"><dt>{t('documents.col.total')}</dt><dd className="tabular-nums">{formatMoney(centsToText(subtotal), type.currency, locale)}</dd></div>
        </dl>
      </section>

      <section className="np-card space-y-3 p-4 lg:p-5">
        <label className="block space-y-1"><span className={fieldLabel}>{t('documents.comments')}</span>
          <textarea value={comments} maxLength={10000} rows={4} onChange={(event) => setComments(event.target.value)} className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text shadow-soft outline-none placeholder:text-text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25" />
        </label>
      </section>

      <section className="np-card space-y-3 p-4 lg:p-5">
        <h3 className="text-sm font-semibold text-text">{t('documents.attachments')}</h3>
        <ul className="flex flex-wrap gap-2" aria-label={t('documents.attachments')}>
          {current && existingAttachments.map((attachment) => <Thumb key={attachment.id} organizationId={organizationId} documentId={current.id} attachment={attachment} removable onRemove={() => void dropExisting(attachment)} label={t('documents.removeAttachment')} />)}
          {pending.map((entry) => (
            <li key={entry.key} className="group relative size-24 overflow-hidden rounded-lg border border-dashed border-border-strong">
              <img src={entry.url} alt={entry.file.name} className="size-full object-cover" />
              <button type="button" onClick={() => dropPending(entry.key)} aria-label={`${t('documents.removeAttachment')} ${entry.file.name}`} className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-text-secondary shadow-soft hover:text-error"><X className="size-3.5" /></button>
            </li>
          ))}
          <li>
            <label className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-strong text-xs text-text-secondary transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent focus-within:ring-2 focus-within:ring-accent/25">
              <ImageSquare className="size-5" />{t('documents.addImage')}
              <input type="file" accept={IMAGE_ACCEPT} multiple className="sr-only" onChange={addFiles} />
            </label>
          </li>
        </ul>
        <p className="text-xs text-text-muted">{t('documents.attach.hint')}</p>
      </section>

      <ErrorNote message={error} />
      {submitted && !valid && !error && <p role="alert" className="text-xs text-error">{t('documents.invalid')}</p>}
      <div data-bottom-bar className="sticky bottom-0 z-(--z-sticky) -mx-1 flex justify-end gap-2 border-t border-border bg-background/90 px-1 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur max-md:[&>button]:flex-1">
        <Button variant="secondary" onClick={() => void save(false)} disabled={saving !== null}><FloppyDisk className="size-4" />{saving === 'draft' ? t('documents.saving') : t('documents.saveDraft')}</Button>
        <Button variant="accent" onClick={() => void save(true)} disabled={saving !== null}>{saving === 'final' ? t('documents.saving') : t('documents.finalize')}</Button>
      </div>
    </div>
  );
}
