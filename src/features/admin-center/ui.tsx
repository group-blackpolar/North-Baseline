import { useCallback, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { LockSimple } from '@phosphor-icons/react';
import { Icon, type IconComponent } from '@/components/ui/icon';
import { Status } from '@/components/ui/status';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { apiCache } from '@/lib/apiCache';

export { Shell, Notice, LoadError, Loading, errorText, td, th, selectClass, useList, useBusy } from '@/features/access-admin/ui';

/** Accessible tab strip (roving arrow keys). Stateless: the caller owns `value`. */
export function SectionTabs<T extends string>({ tabs, value, onChange, label, className }: {
  tabs: Array<{ id: T; label: string; icon?: IconComponent; badge?: string | number }>;
  value: T; onChange: (id: T) => void; label: string; className?: string;
}) {
  const base = useId();
  const refs = useRef(new Map<T, HTMLButtonElement>());
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (event.key === 'Home' || event.key === 'End' || step) {
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + step + tabs.length) % tabs.length;
      const target = tabs[next]!;
      onChange(target.id);
      refs.current.get(target.id)?.focus();
    }
  }, [onChange, tabs, value]);
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn('flex max-w-full gap-1 overflow-x-auto rounded-lg bg-surface-hover p-1', className)}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id} ref={(node) => { if (node) refs.current.set(tab.id, node); else refs.current.delete(tab.id); }}
            role="tab" id={`${base}-${tab.id}`} aria-selected={selected} tabIndex={selected ? 0 : -1} type="button" onClick={() => onChange(tab.id)}
            className={cn('np-press-flat flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-(--duration-fast) pointer-coarse:min-h-(--touch-min)', selected ? 'bg-surface text-text shadow-soft' : 'text-text-muted hover:text-text')}
          >
            {tab.icon ? <Icon icon={tab.icon} size="xs" /> : null}
            {tab.label}
            {tab.badge !== undefined ? <span className="rounded-full bg-surface-active px-1.5 text-[10px] tabular-nums text-text-secondary">{tab.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Honest placeholder for a capability CORECROW does not expose yet. It names what is missing instead of faking a
 * working control, so a section can never look finished when it is not.
 */
export function Unavailable({ title, body, needs, tone = 'blocked' }: { title: string; body: string; needs?: string; tone?: 'blocked' | 'forbidden' }) {
  const { t } = useI18n();
  return (
    <div role="note" className="flex items-start gap-3 rounded-xl border border-dashed border-border-strong/60 bg-surface-hover/40 p-4">
      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-active text-text-muted"><Icon icon={LockSimple} size="sm" weight="duotone" /></div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-text">{title}</p>
          <Status tone={tone === 'forbidden' ? 'error' : 'pending'}>{tone === 'forbidden' ? t('adm2.forbidden') : t('adm2.blocked')}</Status>
        </div>
        <p className="text-xs leading-relaxed text-text-secondary">{body}</p>
        {needs ? <p className="text-[11px] text-text-muted"><span className="font-medium">{t('adm2.needs')}:</span> {needs}</p> : null}
      </div>
    </div>
  );
}

export function KeyValue({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-text-secondary">{label}</dt>
      <dd className={cn('min-w-0 truncate text-right text-xs text-text', mono && 'mono-data')}>{children}</dd>
    </div>
  );
}

/** Drops cached reads of one tenant so the next load asks CORECROW (used by every "Refresh" button). */
export const invalidateOrganization = (organizationId: string) => apiCache.invalidateTag(`org:${organizationId}`);

export const toneForStatus = (status: string): 'active' | 'pending' | 'error' | 'neutral' | 'info' => {
  const value = status.toUpperCase();
  if (['ACTIVE', 'PUBLISHED', 'READY', 'ACCEPTED', 'SUCCEEDED', 'COMPLETED', 'PAID'].includes(value)) return 'active';
  if (['PENDING', 'PAST_DUE', 'DRAFT', 'PROCESSING', 'RUNNING', 'UPLOADING'].includes(value)) return 'pending';
  if (['FAILED', 'SUSPENDED', 'REJECTED', 'QUARANTINED', 'CLOSED', 'EXPIRED', 'REVOKED'].includes(value)) return 'error';
  return 'neutral';
};
