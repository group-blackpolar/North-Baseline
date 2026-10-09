import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sheet } from '@/components/ui/sheet';
import { Tooltip } from '@/components/ui/tooltip';
import { portalContainer } from '@/components/ui/portal';
import { useOrganization } from '@/context/OrganizationContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useI18n } from '@/lib/i18n';
import { useIsCompactShell } from '@/lib/responsive';
import { cn } from '@/lib/utils';
import { AssistantPanel } from './AssistantPanel';
import { RavenIcon } from './RavenIcon';

/**
 * The raven button plus its chat. Desktop: a floating, non-modal card next to the layout bar (the workspace stays usable);
 * phone and portrait tablet: a bottom sheet. Cuervo works inside an organization because CoreCrow answers by membership;
 * in the Personal Workspace it only explains that.
 */
export function AssistantLauncher({ variant }: { variant: 'bar' | 'header' }) {
  const { t } = useI18n();
  const compact = useIsCompactShell();
  const { activeOrganization } = useOrganization();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const personal = !activeOrganization || activeOrganization.id === PERSONAL_ORG_ID;

  const close = () => { setOpen(false); button.current?.focus(); };
  useEffect(() => {
    if (!open || compact) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, compact]);

  const trigger = (
    <button
      ref={button} type="button" aria-label={t('assistant.open')} aria-expanded={open} aria-haspopup="dialog"
      onClick={() => setOpen((value) => !value)}
      className={cn(
        'grid place-items-center rounded-lg outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-accent/40',
        variant === 'bar' ? 'size-8' : 'size-(--touch-min)',
        open ? 'bg-surface-active text-text shadow-soft ring-1 ring-border' : 'text-text-muted hover:bg-surface-hover hover:text-text',
      )}
    >
      <RavenIcon size={variant === 'bar' ? 18 : 22} />
    </button>
  );

  const body = personal
    ? (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-surface-active text-text"><RavenIcon size={30} /></span>
        <p className="font-display text-[15px] font-semibold text-text">{t('assistant.personal.title')}</p>
        <p className="text-[13px] text-text-secondary">{t('assistant.personal.body')}</p>
      </div>
    )
    : <AssistantPanel organizationId={activeOrganization.id} onClose={close} autoFocus={!compact} />;

  return (
    <>
      {variant === 'bar' ? <Tooltip label={t('assistant.name')} side="left">{trigger}</Tooltip> : trigger}
      {open && compact && (
        <Sheet open onOpenChange={(next) => { if (!next) close(); }} title={t('assistant.name')} hideTitle side="bottom" className="h-[85dvh]">
          <div className="-mx-4 -mb-4 h-[calc(85dvh-3.5rem)]">{body}</div>
        </Sheet>
      )}
      {open && !compact && createPortal(
        <section
          role="dialog" aria-modal="false" aria-label={t('assistant.name')}
          style={{ right: 'calc(var(--shell-layout-switcher) + 0.75rem)' }}
          className="np-dialog fixed bottom-4 top-24 z-(--z-popover) w-[min(24rem,calc(100vw-6rem))] overflow-hidden rounded-2xl border border-border bg-surface shadow-overlay"
        >
          {body}
        </section>,
        portalContainer() ?? document.body,
      )}
    </>
  );
}
