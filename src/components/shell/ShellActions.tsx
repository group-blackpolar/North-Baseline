import { useRef, useState } from 'react';
import { Keyboard, Lifebuoy, MagnifyingGlass, Question, Sparkle } from '@phosphor-icons/react';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Popover } from '@/components/ui/popover';
import { useOrganization } from '@/context/OrganizationContext';
import { OPEN_ASSISTANT_EVENT } from '@/features/assistant/openEvent';
import { PERSONAL_ORG_ID } from '@/lib/demo/store';
import { useI18n } from '@/lib/i18n';
import { GlobalSearch, OPEN_SEARCH_EVENT } from './GlobalSearch';

const GLASS = 'shadow-[0_0_0_1px_var(--color-border),0_6px_16px_-8px_rgb(30_58_138/0.3)] bg-gradient-to-b from-surface to-surface-hover';

/** The controls above the workspace (UX-01c): search, notifications, help and CoreCrow AI. */
export function ShellActions() {
  const { t, locale } = useI18n();
  const { activeOrganization } = useOrganization();
  const [help, setHelp] = useState(false);
  const helpAnchor = useRef<HTMLButtonElement>(null);
  const personal = !activeOrganization || activeOrganization.id === PERSONAL_ORG_ID;
  const localePath = locale === 'es' ? 'es' : 'en';
  const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));

  return (
    <div className="ml-auto flex items-center gap-2.5">
      <button type="button" onClick={openSearch} className={`${GLASS} hidden h-9 w-64 items-center gap-2.5 rounded-xl px-3 text-left text-[13px] text-text-muted transition-colors duration-(--duration-fast) hover:text-text-secondary @[56rem]:flex`}>
        <MagnifyingGlass className="size-4 shrink-0 text-text-secondary" />
        <span className="min-w-0 flex-1 truncate">{t('search.placeholder', { name: personal ? 'NORTH' : activeOrganization?.name ?? 'NORTH' })}</span>
        <span className="flex gap-1"><kbd className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">Ctrl</kbd><kbd className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">K</kbd></span>
      </button>
      <button type="button" aria-label={t('search.title')} onClick={openSearch} className={`${GLASS} grid size-9 place-items-center rounded-xl text-text-secondary @[56rem]:hidden`}><MagnifyingGlass className="size-[18px]" /></button>
      <NotificationBell />
      <button ref={helpAnchor} type="button" aria-label={t('help.title')} aria-expanded={help} aria-haspopup="dialog" onClick={() => setHelp((value) => !value)} className={`${GLASS} grid size-9 place-items-center rounded-xl text-text-secondary transition-colors duration-(--duration-fast) hover:text-text`}><Question className="size-[18px]" /></button>
      <Popover open={help} onOpenChange={setHelp} anchorRef={helpAnchor} label={t('help.title')} minWidth={280}>
        <div className="border-b border-border px-3.5 py-2.5"><p className="font-display text-[14px] font-bold">{t('help.title')}</p></div>
        <div className="space-y-0.5 p-1.5">
          <a href={`https://blackpolar.org/${localePath}/contact`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] font-medium text-text transition-colors duration-(--duration-fast) hover:bg-surface-hover"><span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-polar"><Lifebuoy className="size-4" /></span>{t('help.support')}</a>
          <div className="rounded-lg px-2.5 py-2">
            <p className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted"><Keyboard className="size-3.5" />{t('help.shortcuts')}</p>
            <dl className="space-y-1 text-[12.5px] text-text-secondary">
              <div className="flex items-center justify-between"><dt>{t('help.shortcut.search')}</dt><dd><kbd className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-bold">Ctrl K</kbd></dd></div>
              <div className="flex items-center justify-between"><dt>{t('help.shortcut.close')}</dt><dd><kbd className="rounded bg-surface-active px-1.5 py-0.5 text-[10px] font-bold">Esc</kbd></dd></div>
            </dl>
          </div>
        </div>
      </Popover>
      {!personal ? (
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT))} className="inline-flex h-9 items-center gap-2 rounded-xl bg-gradient-to-br from-[#1B2E5C] via-[#2B49A8] to-ai px-3.5 text-[13px] font-bold text-white shadow-[0_10px_22px_-8px_rgb(52_80_190/0.75),inset_0_1px_0_rgb(255_255_255/0.25)] transition-opacity duration-(--duration-fast) hover:opacity-90">
          <Sparkle className="size-4" weight="fill" aria-hidden="true" />CoreCrow AI
        </button>
      ) : null}
      <GlobalSearch />
    </div>
  );
}
