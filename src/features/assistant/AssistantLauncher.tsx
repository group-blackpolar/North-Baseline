import { useEffect, useRef } from 'react';
import { Tooltip } from '@/components/ui/tooltip';
import { useOrganization } from '@/context/OrganizationContext';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { useOptionalAssistantUi } from './AssistantContext';
import { OPEN_ASSISTANT_EVENT } from './openEvent';
import { RavenIcon } from './RavenIcon';

/**
 * The raven button. It only toggles the assistant between closed and its last visible mode; the chat itself (compact card, side panel, full
 * workspace) is rendered once by AssistantSurfaces/AssistantDock and shares one conversation. In the Personal Workspace it only explains
 * that the assistant works inside an organization (CoreCrow answers by membership).
 */
export function AssistantLauncher({ variant }: { variant: 'bar' | 'header' }) {
  const { t } = useI18n();
  const { activeOrganization } = useOrganization();
  const ui = useOptionalAssistantUi();
  const button = useRef<HTMLButtonElement>(null);
  const personal = !activeOrganization || activeOrganization.id === PERSONAL_ORG_ID;
  const open = ui ? ui.mode !== 'closed' : false;
  const lastVisible = useRef<'compact' | 'side'>('compact');
  if (ui && (ui.mode === 'compact' || ui.mode === 'side')) lastVisible.current = ui.mode;

  useEffect(() => {
    if (!ui) return undefined;
    const show = () => { if (ui.mode === 'closed') ui.setMode(lastVisible.current); };
    window.addEventListener(OPEN_ASSISTANT_EVENT, show);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, show);
  }, [ui]);

  const trigger = (
    <button
      ref={button} type="button" aria-label={t('assistant.open')} aria-expanded={open} aria-haspopup="dialog"
      onClick={() => { if (ui) ui.setMode(open ? 'closed' : lastVisible.current); }}
      className={cn(
        'grid place-items-center rounded-lg outline-none transition-colors duration-(--duration-fast) focus-visible:ring-2 focus-visible:ring-accent/40',
        variant === 'bar' ? 'size-8' : 'size-(--touch-min)',
        open ? 'bg-surface-active text-text shadow-soft ring-1 ring-border' : 'text-text-muted hover:bg-surface-hover hover:text-text',
      )}
    >
      <RavenIcon size={variant === 'bar' ? 18 : 22} />
    </button>
  );
  void personal;
  return variant === 'bar' ? <Tooltip label={t('assistant.name')} side="left">{trigger}</Tooltip> : trigger;
}
