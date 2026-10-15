import { useState } from 'react';
import { DashboardCard } from '@/components/dashboard/primitives';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { usePermissions } from '@/context/PermissionContext';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { REGISTERED_PERMISSIONS, cancelAccessRequest, createAccessRequest, decideAccessRequest, listAccessRequests, type AccessRequest, type RegisteredPermission } from './api';
import { permissionLabelKey } from './permissionCatalog';
import { Loading, Notice, selectClass, useBusy, useList } from './ui';

const STATUS_TONE: Record<AccessRequest['status'], string> = { PENDING: 'text-accent', APPROVED: 'text-success', DENIED: 'text-error', CANCELLED: 'text-text-muted' };

/** Shared by both cards: "caduca el …" for a temporary grant, empty for a permanent one. */
export function ExpiryNote({ expiresAt }: { expiresAt: string | null | undefined }) {
  const { t, locale } = useI18n();
  if (!expiresAt) return null;
  return <span className="text-[11px] text-warning">{t('ar.expires', { date: new Date(expiresAt).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) })}</span>;
}

/** Any member can ask for a permission they do not have, and follow or withdraw their own requests. */
export function RequestAccessCard({ organizationId, onChanged }: { organizationId: string; onChanged: () => void }) {
  const { t, locale } = useI18n();
  const { permissions } = usePermissions();
  const mine = useList(() => listAccessRequests(organizationId, 'mine'), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [permission, setPermission] = useState<RegisteredPermission | ''>('');
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const open = new Set((mine.data ?? []).filter((request) => request.status === 'PENDING').map((request) => request.permission));
  const options = REGISTERED_PERMISSIONS.filter((value) => !permissions.includes(value) && !open.has(value));
  const daysValid = days.trim() === '' || (Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 365);
  const valid = permission !== '' && reason.trim().length >= 5 && daysValid;
  const submit = () => permission && void act('create', async () => {
    await createAccessRequest(organizationId, { permission, reason: reason.trim(), ...(days.trim() ? { days: Number(days) } : {}) });
    setPermission(''); setReason(''); setDays('');
    await mine.reload();
  }, t('ar.sent'));
  return (
    <DashboardCard title={t('ar.request.title')} description={t('ar.request.hint')}>
      <div className="space-y-3">
        <label className="block text-xs text-text-secondary">{t('ar.permission')}
          <select className={cn(selectClass, 'mt-1 w-full')} value={permission} onChange={(event) => setPermission(event.target.value as RegisteredPermission | '')}>
            <option value="">{t('ar.pick')}</option>
            {options.map((value) => <option key={value} value={value}>{t(permissionLabelKey(value) as never)}</option>)}
          </select>
        </label>
        <label className="block text-xs text-text-secondary">{t('ar.reason')}
          <textarea className="mt-1 min-h-16 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-base md:text-xs text-text" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <label className="block text-xs text-text-secondary">{t('ar.days')}
          <Input className="mt-1 w-28" type="number" min={1} max={365} value={days} aria-invalid={!daysValid} onChange={(event) => setDays(event.target.value)} />
        </label>
        <Notice error={error ?? mine.error} ok={ok} />
        <Button size="sm" disabled={!valid || busy !== null} loading={busy === 'create'} onClick={submit}>{t('ar.send')}</Button>
        {mine.loading && !mine.data ? <Loading /> : (mine.data ?? []).length > 0 ? (
          <ul className="space-y-1.5 border-t border-border pt-2">
            {(mine.data ?? []).slice(0, 8).map((request) => (
              <li key={request.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
                <span className="text-text">{t(permissionLabelKey(request.permission) as never)}</span>
                <span className="flex items-center gap-2">
                  <span className={STATUS_TONE[request.status]}>{t(`ar.status.${request.status}` as never)}</span>
                  {request.status === 'APPROVED' ? <ExpiryNote expiresAt={request.grantExpiresAt} /> : null}
                  {request.decisionNote ? <span className="text-text-muted">“{request.decisionNote}”</span> : null}
                  <span className="text-text-muted">{new Date(request.createdAt).toLocaleDateString(locale)}</span>
                  {request.status === 'PENDING' ? <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void act(request.id, async () => { await cancelAccessRequest(organizationId, request.id); await mine.reload(); onChanged(); })}>{t('ar.cancel')}</Button> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </DashboardCard>
  );
}

/** Reachable from the profile menu so a member without any administration screen can still ask for what they are missing. */
export function RequestAccessDialog({ organizationId, open, onClose }: { organizationId: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={t('ar.request.title')} size="md">
      {open ? <RequestAccessCard organizationId={organizationId} onChanged={() => undefined} /> : null}
    </Dialog>
  );
}

/** Queue for people with permissions.manage: approve (optionally for a number of days) or deny with a note. */
export function AccessRequestQueueCard({ organizationId, onChanged }: { organizationId: string; onChanged: () => void }) {
  const { t } = useI18n();
  const queue = useList(() => listAccessRequests(organizationId, 'all', 'PENDING'), [organizationId]);
  const { busy, error, ok, act } = useBusy();
  const [days, setDays] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const decide = (request: AccessRequest, decision: 'APPROVE' | 'DENY') => void act(request.id, async () => {
    const chosen = (days[request.id] ?? (request.requestedDays ? String(request.requestedDays) : '')).trim();
    await decideAccessRequest(organizationId, request.id, { decision, ...(notes[request.id]?.trim() ? { note: notes[request.id].trim() } : {}), ...(decision === 'APPROVE' ? { days: chosen === '' ? null : Number(chosen) } : {}) });
    await queue.reload();
    onChanged();
  }, decision === 'APPROVE' ? t('ar.approved') : t('ar.denied'));
  return (
    <DashboardCard title={t('ar.queue.title')} description={t('ar.queue.hint')}>
      <Notice error={error ?? queue.error} ok={ok} />
      {queue.loading && !queue.data ? <Loading /> : (queue.data ?? []).length === 0 ? <p className="text-xs text-text-muted">{t('ar.queue.empty')}</p> : (
        <ul className="space-y-3">
          {(queue.data ?? []).map((request) => {
            const chosen = days[request.id] ?? (request.requestedDays ? String(request.requestedDays) : '');
            const valid = chosen.trim() === '' || (Number.isInteger(Number(chosen)) && Number(chosen) >= 1 && Number(chosen) <= 365);
            return (
              <li key={request.id} className="space-y-1.5 rounded-lg border border-border p-2.5 text-xs">
                <p className="text-text"><span className="font-medium">{request.requester?.name ?? request.requester?.email}</span> · {t(permissionLabelKey(request.permission) as never)}</p>
                <p className="text-text-secondary">{request.reason}</p>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="text-text-secondary">{t('ar.daysApprove')}
                    <Input className="mt-1 w-24" type="number" min={1} max={365} value={chosen} aria-invalid={!valid} onChange={(event) => setDays((current) => ({ ...current, [request.id]: event.target.value }))} />
                  </label>
                  <label className="min-w-0 flex-1 text-text-secondary">{t('ar.note')}
                    <Input className="mt-1 w-full" maxLength={500} value={notes[request.id] ?? ''} onChange={(event) => setNotes((current) => ({ ...current, [request.id]: event.target.value }))} />
                  </label>
                  <Button size="sm" disabled={!valid || busy !== null} loading={busy === request.id} onClick={() => decide(request, 'APPROVE')}>{t('ar.approve')}</Button>
                  <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => decide(request, 'DENY')}>{t('ar.deny')}</Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardCard>
  );
}
